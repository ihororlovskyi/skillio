import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readLock } from '../lock/file';
import { extractMode } from '../utils/mode';
import { collectRows, renderSkillTable, type SkillRoots } from '../utils/skill-table';
import { runSymlink } from './symlink';

export interface SpawnOutcome {
  status: number | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
}

export type Spawner = (command: string, args: string[], capture: boolean) => SpawnOutcome;

export interface InstallDeps {
  spawn?: Spawner;
  cwd?: string;
  home?: string;
  confirm?: (question: string) => Promise<boolean>;
}

// Node >= 20 refuses to spawn npx.cmd without a shell on Windows (EINVAL)
const defaultSpawn: Spawner = (command, args, capture) => {
  const r = spawnSync(command, args, {
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return { status: r.status, error: r.error, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

export const INSTALL_HELP = [
  'Install skills: run `npx -y skills add`, or symlink a local clone with -ln.',
  '',
  'USAGE skillio install <source> [OPTIONS]',
  '       skillio i <source> [OPTIONS]',
  '       skillio i -ln <path> [-s <SKILL...> | -x <SKILL...>] [-a <AGENT...>] [-y]',
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

function runSilent(args: string[], spawn: Spawner, deps: InstallDeps): number {
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
  const first = args[0];
  const from = first !== undefined && !first.startsWith('-') ? ` from ${first}` : '';

  console.log(`Installing${from}...`);
  const before = snapshotSkills(roots, lockPath);
  const r = spawn('npx', ['-y', 'skills', 'add', ...args], true);
  if (r.error || r.status === null || r.status !== 0) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.error || r.status === null) {
      console.error(`skl install: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
      return 1;
    }
    return r.status;
  }
  const after = snapshotSkills(roots, lockPath);
  const changed = [...after.keys()].filter((name) => after.get(name) !== before.get(name));
  console.log(`Installed ${plural(changed.length, 'skill')}${from}`);
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
  const r = spawn('npx', ['-y', 'skills', 'add', ...args], false);
  if (r.error || r.status === null) {
    console.error(`skl install: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
    return 1;
  }
  return r.status;
}
