import { spawn as spawnAsync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readLock } from '../lock/file';
import { extractMode } from '../utils/mode';
import { createProgress } from '../utils/progress';
import { collectRows, renderSkillTable, type SkillRoots } from '../utils/skill-table';
import { runSymlink } from './symlink';

export interface SpawnOutcome {
  status: number | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
}

export type Spawner = (
  command: string,
  args: string[],
  capture: boolean,
) => SpawnOutcome | Promise<SpawnOutcome>;

export interface InstallDeps {
  spawn?: Spawner;
  cwd?: string;
  home?: string;
  confirm?: (question: string) => Promise<boolean>;
}

// Node >= 20 refuses to spawn npx.cmd without a shell on Windows (EINVAL)
const defaultSpawn: Spawner = (command, args, capture) => {
  if (!capture) {
    const r = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    return { status: r.status, error: r.error };
  }
  // async so the progress line can redraw while npx runs
  return new Promise((done) => {
    const child = spawnAsync(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    // decode per stream so a multibyte character split across chunks stays intact
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (error) => done({ status: null, error, stdout, stderr }));
    child.on('close', (status) => done({ status, stdout, stderr }));
  });
};

export const INSTALL_HELP = [
  'Install skills: run `npx -y skills add`, or symlink a local clone with -ln.',
  '',
  'USAGE skl-x install <source> [OPTIONS]',
  '       skl-x i <source> [OPTIONS]',
  '       skl-x i -ln <path> [-s <SKILL...> | -x <SKILL...>] [-a <AGENT...>] [-y]',
  '',
  'Without -ln every argument except -m/--mode is passed to `npx skills add` unchanged;',
  'see `npx skills add --help`.',
  '',
  'OPTIONS',
  '',
  '  -ln, --link         Symlink <path>/skills/<name> into .agents/skills and .claude/skills',
  '                      instead of running npx; skills-lock.json is not changed',
  '  -s, --skill         With -ln: skill names (default: every skill except metadata.internal)',
  '  -x, --reject        With -ln: every skill except these',
  '  -a, --agent         With -ln: codex (.agents/skills), claude-code (.claude/skills) (default: both)',
  '  -y, --yes           Skip npx prompts; with -ln: replace existing copies without asking',
  '  -m, --mode silent   Hide the npx output, print a summary and a table (needs -y)',
  '',
  'EXAMPLES',
  '',
  '  skl i sentimony/skills -s cross-review tdd -a codex claude-code -y',
  '  skl i sentimony/skills -l',
  '  skl i sentimony/skills -s tdd -y -m s',
  '  skl i -ln ../skills -a codex claude-code -y',
  '  skl i -ln ../skills -x scope-check echarts -y',
].join('\n');

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// One signature per skill name across both dirs and the lock; a reinstall changes the inode,
// the mtime of the entry or of SKILL.md, the link target or the lock entry. Nanosecond stats:
// ext4 reuses a freed inode at once, and a reinstall can land in the same millisecond
export function snapshotSkills(roots: SkillRoots, lockPath: string): Map<string, string> {
  const parts = new Map<string, string[]>();
  const add = (name: string, part: string) => parts.set(name, [...(parts.get(name) ?? []), part]);
  for (const [key, root] of [
    ['a', roots.agents],
    ['c', roots.claude],
  ] as const) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      const l = lstatSync(dir, { bigint: true });
      const link = l.isSymbolicLink() ? readlinkSync(dir) : '';
      const md = statSync(join(dir, 'SKILL.md'), { bigint: true, throwIfNoEntry: false });
      add(name, `${key}:${l.ino}:${l.mtimeNs}:${link}:${md?.mtimeNs ?? ''}`);
    }
  }
  for (const [name, entry] of Object.entries(readLock(lockPath).skills))
    add(name, `l:${JSON.stringify(entry)}`);
  return new Map([...parts].map(([name, p]) => [name, p.join('|')]));
}

// `owner/repo` is the GitHub shorthand of `npx skills add`; URLs, paths and deeper paths stay as given
export function sourceLabel(first: string | undefined): string {
  if (first === undefined || first.startsWith('-')) return '';
  return /^[A-Za-z0-9_-][\w.-]*\/[\w.-]+$/.test(first) ? `https://github.com/${first}` : first;
}

// names after -s/--skill up to the next flag; '*' asks for every skill, so there is no total
export function requestedSkills(args: string[]): string[] | null {
  const names: string[] = [];
  args.forEach((t, i) => {
    if (t !== '-s' && t !== '--skill') return;
    for (const n of args.slice(i + 1)) {
      if (n.startsWith('-')) break;
      names.push(n);
    }
  });
  return names.length === 0 || names.includes('*') ? null : [...new Set(names)];
}

async function runSilent(args: string[], spawn: Spawner, deps: InstallDeps): Promise<number> {
  if (!args.includes('-y') && !args.includes('--yes')) {
    console.error(
      'skl install: --mode silent needs -y/--yes (npx skills add asks questions otherwise)',
    );
    return 1;
  }
  const isGlobal = args.includes('-g') || args.includes('--global');
  const home = deps.home ?? homedir();
  const base = isGlobal ? home : (deps.cwd ?? process.cwd());
  const roots = {
    agents: join(base, '.agents', 'skills'),
    claude: join(base, '.claude', 'skills'),
  };
  const lockPath = isGlobal
    ? join(home, '.agents', '.skill-lock.json')
    : join(base, 'skills-lock.json');
  const from = sourceLabel(args[0]);
  const progress = createProgress(from ? `Installing from ${from}` : 'Installing');
  const requested = requestedSkills(args);
  const before = snapshotSkills(roots, lockPath);
  const changedSince = () => {
    const now = snapshotSkills(roots, lockPath);
    return [...now.keys()].filter((name) => now.get(name) !== before.get(name));
  };
  const tick = () => {
    if (requested === null) return progress.update(null);
    // npx may remove an entry between readdir and lstat; skip that frame
    try {
      const changed = new Set(changedSince());
      const done = requested.filter((n) => changed.has(n)).length;
      progress.update(Math.min(0.99, done / requested.length));
    } catch {}
  };
  tick();
  const timer = setInterval(tick, 100);
  let r: SpawnOutcome;
  try {
    r = await spawn('npx', ['-y', 'skills', 'add', ...args], true);
  } finally {
    clearInterval(timer);
  }
  if (r.error || r.status === null || r.status !== 0) {
    progress.fail();
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.error || r.status === null) {
      console.error(`skl install: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
      return 1;
    }
    return r.status;
  }
  const changed = changedSince();
  progress.done(`Installed ${plural(changed.length, 'skill')}`);
  if (changed.length === 0) return 0;
  const lockNames = new Set(Object.keys(readLock(lockPath).skills));
  const lockLabel = isGlobal ? '.agents/.skill-lock.json' : 'skills-lock.json';
  for (const line of renderSkillTable(collectRows(changed, roots, lockNames), {
    lockLabel,
    total: false,
  }))
    console.log(line);
  return 0;
}

export async function runInstall(argv: string[], deps: InstallDeps = {}): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(INSTALL_HELP);
    return 0;
  }
  const mode = extractMode(argv);
  if (mode.kind === 'error') {
    console.error(`skl install: ${mode.message}`);
    return 1;
  }
  const args = mode.rest;
  if (args.includes('-ln') || args.includes('--link')) {
    return runSymlink(
      args.filter((t) => t !== '-ln' && t !== '--link'),
      { cwd: deps.cwd, confirm: deps.confirm },
    );
  }
  const spawn = deps.spawn ?? defaultSpawn;
  if (mode.silent) return runSilent(args, spawn, deps);
  const r = await spawn('npx', ['-y', 'skills', 'add', ...args], false);
  if (r.error || r.status === null) {
    console.error(`skl install: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
    return 1;
  }
  return r.status;
}
