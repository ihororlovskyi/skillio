import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { createConfirmer } from '../utils/confirm';

export type Agent = 'codex' | 'claude-code';

export const AGENT_DIRS: Record<Agent, string> = {
  codex: '.agents/skills',
  'claude-code': '.claude/skills',
};

export interface SymlinkArgs {
  source: string;
  skills: string[];
  agents: Agent[];
  yes: boolean;
}

export type ParsedSymlinkArgs =
  | { kind: 'help' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; args: SymlinkArgs };

function isAgent(value: string): value is Agent {
  return value === 'codex' || value === 'claude-code';
}

function fail(message: string): ParsedSymlinkArgs {
  return { kind: 'error', message };
}

export function parseSymlinkArgs(argv: string[]): ParsedSymlinkArgs {
  if (argv.includes('-h') || argv.includes('--help')) return { kind: 'help' };
  let source: string | null = null;
  const skills: string[] = [];
  const agents: Agent[] = [];
  let yes = false;
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i] ?? '';
    i++;
    if (tok === '-y' || tok === '--yes') {
      yes = true;
      continue;
    }
    if (tok === '-g' || tok === '--global')
      return fail('skl symlink: -g/--global is not supported yet');
    if (tok === '-s' || tok === '--skill' || tok === '-a' || tok === '--agent') {
      const values: string[] = [];
      // a " name" value (shell "\ name") does not start with "-", so it is collected and skipped later
      while (i < argv.length && !(argv[i] ?? '').startsWith('-')) {
        values.push(argv[i] ?? '');
        i++;
      }
      if (values.length === 0) return fail(`skl symlink: ${tok} needs at least one value`);
      if (tok === '-s' || tok === '--skill') {
        // a name is one path segment: ".." or a slash would escape <path>/skills and the target dirs,
        // and a replace would then rm -rf .agents itself
        const bad = values.find(
          (v) => !v.startsWith(' ') && (v === '' || v === '.' || v === '..' || /[\\/]/.test(v)),
        );
        if (bad !== undefined) return fail(`skl symlink: invalid skill name "${bad}"`);
        skills.push(...values);
        continue;
      }
      for (const value of values) {
        if (!isAgent(value))
          return fail(`Unknown agent: "${value}". Use "codex" or "claude-code".`);
        if (!agents.includes(value)) agents.push(value);
      }
      continue;
    }
    if (tok.startsWith('-')) return fail(`Unknown option: ${tok}`);
    if (source !== null) return fail(`skl symlink takes one source, got "${source}" and "${tok}"`);
    source = tok;
  }
  if (source === null) return fail('skl symlink: missing <path>');
  if (skills.length === 0) return fail('skl symlink: missing -s <names...>');
  return {
    kind: 'ok',
    args: { source, skills, agents: agents.length > 0 ? agents : ['codex', 'claude-code'], yes },
  };
}

export type SymlinkAction = 'new' | 'same' | 'replace';
export type Existing = 'none' | 'folder' | 'file' | 'symlink';

export interface SymlinkStep {
  dir: string;
  name: string;
  linkPath: string;
  target: string;
  action: SymlinkAction;
  existing: Existing;
  existingTarget?: string;
}

// Real path of p, resolving the deepest existing ancestor (p itself may not exist yet)
function physicalPath(p: string): string {
  let head = p;
  const rest: string[] = [];
  while (!existsSync(head) && dirname(head) !== head) {
    rest.unshift(basename(head));
    head = dirname(head);
  }
  return join(realpathSync(head), ...rest);
}

export function planSymlinks(opts: {
  cwd: string;
  sourceAbs: string;
  names: string[];
  dirs: string[];
}): SymlinkStep[] {
  const steps: SymlinkStep[] = [];
  const seen = new Set<string>();
  for (const name of opts.names) {
    for (const dir of opts.dirs) {
      const dirAbs = join(opts.cwd, dir);
      // a relative symlink target resolves from the physical parent, so a symlinked
      // .agents/skills needs its real path
      const dirPhys = physicalPath(dirAbs);
      // .claude/skills may be a symlink to .agents/skills: one physical entry, one step
      if (seen.has(join(dirPhys, name))) continue;
      seen.add(join(dirPhys, name));
      const linkPath = join(dirAbs, name);
      const target = relative(dirPhys, join(opts.sourceAbs, 'skills', name));
      const base = { dir, name, linkPath, target };
      // lstat so a dangling symlink is seen (and replaced) instead of looking absent
      const stat = lstatSync(linkPath, { throwIfNoEntry: false });
      if (!stat) {
        steps.push({ ...base, action: 'new', existing: 'none' });
      } else if (stat.isSymbolicLink()) {
        const existingTarget = readlinkSync(linkPath);
        const action = existingTarget === target ? 'same' : 'replace';
        steps.push({ ...base, action, existing: 'symlink', existingTarget });
      } else {
        steps.push({
          ...base,
          action: 'replace',
          existing: stat.isDirectory() ? 'folder' : 'file',
        });
      }
    }
  }
  return steps;
}

// Collect every directory entry (physical parent + name) that resolving p walks through,
// following symlinks segment by segment, so an entry reached via any alias is seen
function walkEntries(p: string, out: Set<string>, depth = 0): string {
  if (depth > 40) throw new Error(`skl symlink: too many levels of symbolic links in ${p}`);
  const root = parse(p).root;
  let cur = root;
  for (const seg of p.slice(root.length).split(sep)) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      cur = dirname(cur);
      continue;
    }
    const entry = join(cur, seg);
    out.add(entry);
    if (lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) {
      // no join/resolve here: they would fold "link/.." lexically and skip the link's entries
      const target = readlinkSync(entry);
      cur = walkEntries(isAbsolute(target) ? target : cur + sep + target, out, depth + 1);
    } else {
      cur = entry;
    }
  }
  return cur;
}

// A replace deletes the existing entry; refuse when resolving the source of any selected skill
// walks through it: the entry itself (e.g. `skl sl .agents -s tdd` over a symlink, also via an
// alias of .agents, would become a self-link) or a replaced folder that holds the source
export function overlapsSource(
  steps: SymlinkStep[],
  sourceAbs: string,
  names: string[],
): SymlinkStep[] {
  const walked = new Set<string>();
  for (const n of names) walkEntries(join(sourceAbs, 'skills', n), walked);
  return steps.filter(
    (s) =>
      s.action === 'replace' &&
      walked.has(join(physicalPath(dirname(s.linkPath)), basename(s.linkPath))),
  );
}

export function applySymlinks(steps: SymlinkStep[]): void {
  for (const step of steps) {
    if (step.action === 'same') continue;
    mkdirSync(dirname(step.linkPath), { recursive: true });
    if (step.action === 'replace') rmSync(step.linkPath, { recursive: true, force: true });
    symlinkSync(step.target, step.linkPath, 'dir');
  }
}

export const SYMLINK_HELP = [
  'Symlink skills from a local clone into .agents/skills and .claude/skills.',
  '',
  'USAGE skillio symlink <path> -s <SKILL...> [OPTIONS]',
  '       skillio sym <path> -s <SKILL...> [OPTIONS]',
  '       skillio sl <path> -s <SKILL...> [OPTIONS]',
  '',
  'ARGUMENTS',
  '',
  '  <path>              Local clone; skills are read from <path>/skills/<name>/SKILL.md',
  '',
  'OPTIONS',
  '',
  '  -s, --skill         Skill names (space-separated); a name starting with a space is skipped',
  '  -a, --agent         codex (.agents/skills), claude-code (.claude/skills) (default: both)',
  '  -y, --yes           Replace existing copies or other symlinks without asking',
  '',
  'skills-lock.json is not changed. Global scope (-g) is not supported yet.',
  '',
  'EXAMPLES',
  '',
  '  skl sl ../skills -s tdd cross-review',
  '  skl sl repositories/skills -s tdd -a claude-code -y',
].join('\n');

export interface SymlinkDeps {
  cwd?: string;
  confirm?: (question: string) => Promise<boolean>;
}

function describeExisting(step: SymlinkStep): string {
  return step.existing === 'symlink' ? `symlink -> ${step.existingTarget}` : step.existing;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export async function runSymlink(argv: string[], deps: SymlinkDeps = {}): Promise<number> {
  const parsed = parseSymlinkArgs(argv);
  if (parsed.kind === 'help') {
    console.log(SYMLINK_HELP);
    return 0;
  }
  if (parsed.kind === 'error') {
    console.error(parsed.message);
    return 1;
  }
  const { source, skills, agents, yes } = parsed.args;
  const cwd = deps.cwd ?? process.cwd();
  // createConfirmer, not confirm: on non-TTY stdin it reads to EOF and answers no instead of hanging
  const ask = deps.confirm ?? createConfirmer();

  const sourceAbs = resolve(cwd, source);
  if (!statSync(sourceAbs, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`skl symlink: ${source} is not a directory`);
    return 1;
  }
  const names = [...new Set(skills.filter((n) => !n.startsWith(' ')))];
  const missing = names.filter((n) => !existsSync(join(sourceAbs, 'skills', n, 'SKILL.md')));
  if (missing.length > 0) {
    for (const n of missing)
      console.error(`skl symlink: ${join(source, 'skills', n, 'SKILL.md')} not found`);
    return 1;
  }

  const dirs = agents.map((a) => AGENT_DIRS[a]);
  const steps = planSymlinks({ cwd, sourceAbs, names, dirs });
  const unsafe = overlapsSource(steps, sourceAbs, names);
  if (unsafe.length > 0) {
    for (const s of unsafe)
      console.error(`skl symlink: ${s.dir}/${s.name} is the source itself, not replacing it`);
    return 1;
  }
  const replaced = steps.filter((s) => s.action === 'replace');
  if (replaced.length > 0 && !yes) {
    for (const s of replaced) console.log(`${s.dir}/${s.name} - ${describeExisting(s)}`);
    const count = new Set(replaced.map((s) => s.name)).size;
    if (!(await ask(`Replace ${plural(count, 'existing skill')}?`))) return 1;
  }
  applySymlinks(steps);
  console.log(`Symlinked ${plural(names.length, 'skill')} from ${source} into ${dirs.join(', ')}`);
  return 0;
}
