import { spawn as spawnAsync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readLock } from '../lock/file';
import { extractMode } from '../utils/mode';
import { createProgress } from '../utils/progress';
import { collectRows, renderSkillTable, type SkillRoots } from '../utils/skill-table';

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

export interface AddDeps {
  spawn?: Spawner;
  cwd?: string;
  home?: string;
}

// Node >= 20 refuses to spawn npx.cmd without a shell on Windows (EINVAL)
export const defaultSpawn: Spawner = (command, args, capture) => {
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

export const ADD_HELP = [
  'Install skills: run `npx -y skills add` with the same arguments.',
  '',
  'USAGE skl-x add <source> [OPTIONS]',
  '',
  'Every argument except -m/--mode is passed to `npx skills add` unchanged;',
  'see `npx skills add --help`.',
  '',
  'OPTIONS',
  '',
  '  -y, --yes           Skip npx prompts (needed by silent and quiet)',
  '  -m, --mode          clear (c, default): the npx output, then a table of the changed skills',
  '                      silent (s): a progress line and the table',
  '                      quiet (q): one "Installed N skills from <source>" line',
  '',
  'EXAMPLES',
  '',
  '  skl add sentimony/skills -l',
  '  skl add sentimony/skills -s cross-review tdd -a codex claude-code -y',
  '  skl add sentimony/skills -s tdd -y -m s',
  '  skl add sentimony/skills -s tdd -y -m q',
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

interface AddScope {
  roots: SkillRoots;
  lockPath: string;
  lockLabel: string;
}

// npx skills add writes to the home dirs with -g, to the current directory otherwise
function addScope(args: string[], deps: AddDeps): AddScope {
  const isGlobal = args.includes('-g') || args.includes('--global');
  const home = deps.home ?? homedir();
  const base = isGlobal ? home : (deps.cwd ?? process.cwd());
  return {
    roots: { agents: join(base, '.agents', 'skills'), claude: join(base, '.claude', 'skills') },
    lockPath: isGlobal ? join(home, '.agents', '.skill-lock.json') : join(base, 'skills-lock.json'),
    lockLabel: isGlobal ? '.agents/.skill-lock.json' : 'skills-lock.json',
  };
}

function changedSince(scope: AddScope, before: Map<string, string>): string[] {
  const now = snapshotSkills(scope.roots, scope.lockPath);
  return [...now.keys()].filter((name) => now.get(name) !== before.get(name));
}

function printTable(scope: AddScope, changed: string[]): void {
  if (changed.length === 0) return;
  const lockNames = new Set(Object.keys(readLock(scope.lockPath).skills));
  const rows = collectRows(changed, scope.roots, lockNames);
  for (const line of renderSkillTable(rows, { lockLabel: scope.lockLabel, total: false }))
    console.log(line);
}

function failedToRun(r: SpawnOutcome): boolean {
  if (!r.error && r.status !== null) return false;
  console.error(`skl add: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
  return true;
}

// a captured run shows what npx printed only when it fails
function reportCapturedFailure(r: SpawnOutcome): number {
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return failedToRun(r) ? 1 : (r.status ?? 1);
}

async function runSilent(args: string[], spawn: Spawner, scope: AddScope): Promise<number> {
  const from = sourceLabel(args[0]);
  const progress = createProgress(from ? `Installing from ${from}` : 'Installing');
  const requested = requestedSkills(args);
  const before = snapshotSkills(scope.roots, scope.lockPath);
  const tick = () => {
    if (requested === null) return progress.update(null);
    // npx may remove an entry between readdir and lstat; skip that frame
    try {
      const changed = new Set(changedSince(scope, before));
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
    return reportCapturedFailure(r);
  }
  const changed = changedSince(scope, before);
  progress.done(`Installed ${plural(changed.length, 'skill')}`);
  printTable(scope, changed);
  return 0;
}

async function runClear(args: string[], spawn: Spawner, scope: AddScope): Promise<number> {
  // the table is extra on top of the npx proxy: a broken lock or skill dir must not stop
  // npx from running or turn its success into a crash, so it only drops the table
  let before: Map<string, string> | null = null;
  try {
    before = snapshotSkills(scope.roots, scope.lockPath);
  } catch {}
  const r = await spawn('npx', ['-y', 'skills', 'add', ...args], false);
  if (failedToRun(r)) return 1;
  if (r.status !== 0) return r.status ?? 1;
  if (before === null) return 0;
  try {
    printTable(scope, changedSince(scope, before));
  } catch {}
  return 0;
}

async function runQuiet(args: string[], spawn: Spawner, scope: AddScope): Promise<number> {
  const before = snapshotSkills(scope.roots, scope.lockPath);
  const r = await spawn('npx', ['-y', 'skills', 'add', ...args], true);
  if (r.error || r.status !== 0) return reportCapturedFailure(r);
  const from = sourceLabel(args[0]);
  const count = plural(changedSince(scope, before).length, 'skill');
  console.log(from ? `Installed ${count} from ${from}` : `Installed ${count}`);
  return 0;
}

export function removedInstallMessage(command: string, args: string[]): string {
  const link = args.find((a) => a === '-ln' || a === '--link');
  return link
    ? `skl ${command} ${link} was removed in 0.4.6, use skl sln`
    : `skl ${command} was removed in 0.4.6, use skl add`;
}

export async function runAdd(argv: string[], deps: AddDeps = {}): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(ADD_HELP);
    return 0;
  }
  const mode = extractMode(argv);
  if (mode.kind === 'error') {
    console.error(`skl add: ${mode.message}`);
    return 1;
  }
  const args = mode.rest;
  if (args.includes('-ln') || args.includes('--link')) {
    console.error('skl add: -ln/--link was removed in 0.4.6, use skl sln');
    return 1;
  }
  if (mode.mode !== 'clear' && !args.includes('-y') && !args.includes('--yes')) {
    console.error(
      `skl add: --mode ${mode.mode} needs -y/--yes (npx skills add asks questions otherwise)`,
    );
    return 1;
  }
  const spawn = deps.spawn ?? defaultSpawn;
  const scope = addScope(args, deps);
  if (mode.mode === 'silent') return runSilent(args, spawn, scope);
  if (mode.mode === 'quiet') return runQuiet(args, spawn, scope);
  return runClear(args, spawn, scope);
}
