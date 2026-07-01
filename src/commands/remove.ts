import { existsSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { countLockLinesToRemove, getLockPath, readLock, removeSkillFromLock } from '../lock/file';
import { green, red, yellow } from '../utils/ansi';
import { createConfirmer } from '../utils/confirm';
import { discoverSkills } from '../utils/discover-skills';
import { countFoldersAndFiles, rmSkillDir } from '../utils/fs-rm';

type LocationKind = 'real' | 'symlink' | 'missing';

interface LocationInfo {
  kind: LocationKind;
  folders: number;
  files: number;
}

interface SkillTarget {
  name: string;
  agentsDir: string;
  claudeDir: string;
  agents: LocationInfo;
  claude: LocationInfo;
}

type Scope = 'all' | 'lock-only' | 'agents-only' | 'claude-only';

function buildLocation(dir: string): LocationInfo {
  if (!existsSync(dir)) return { kind: 'missing', folders: 0, files: 0 };
  if (lstatSync(dir).isSymbolicLink()) return { kind: 'symlink', folders: 0, files: 0 };
  const { folders, files } = countFoldersAndFiles(dir);
  return { kind: 'real', folders, files };
}

function rootFor(base: '.agents' | '.claude', isGlobal: boolean, lockPath: string): string {
  return isGlobal
    ? join(homedir(), base, 'skills')
    : join(dirname(resolve(lockPath)), base, 'skills');
}

function buildTarget(name: string, isGlobal: boolean, lockPath: string): SkillTarget {
  const agentsDir = join(rootFor('.agents', isGlobal, lockPath), name);
  const claudeDir = join(rootFor('.claude', isGlobal, lockPath), name);
  return {
    name,
    agentsDir,
    claudeDir,
    agents: buildLocation(agentsDir),
    claude: buildLocation(claudeDir),
  };
}

function collectAllTargets(isGlobal: boolean, lockPath: string): SkillTarget[] {
  const map = discoverSkills({ isGlobal, cwd: process.cwd(), lockPath });
  return [...map.keys()].sort().map((name) => buildTarget(name, isGlobal, lockPath));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function header(targets: SkillTarget[], verb: string): string {
  const names = targets.map((t) => red(t.name)).join(' ');
  return `${plural(targets.length, 'skill')} ${names} ${verb}`;
}

function aggregateLocations(infos: LocationInfo[]): {
  folders: number;
  files: number;
  symlinks: number;
  found: boolean;
} {
  let folders = 0;
  let files = 0;
  let symlinks = 0;
  for (const info of infos) {
    if (info.kind === 'real') {
      folders += info.folders;
      files += info.files;
    } else if (info.kind === 'symlink') {
      symlinks += 1;
    }
  }
  return { folders, files, symlinks, found: infos.some((i) => i.kind !== 'missing') };
}

function diskLine(
  label: string,
  singleName: string | undefined,
  infos: LocationInfo[],
  variant: 'plan' | 'summary',
): string {
  const displayLabel = singleName ? `${label}/${singleName}/` : label;
  const agg = aggregateLocations(infos);
  if (!agg.found) return `  ${displayLabel}  (not found)`;
  const parts: string[] = [];
  if (agg.folders > 0 || agg.files > 0) {
    const text = `${plural(agg.folders, 'folder')}, ${plural(agg.files, 'file')}`;
    parts.push(variant === 'summary' ? red(text) : green(text));
  }
  if (agg.symlinks > 0) {
    const text = plural(agg.symlinks, 'symlink');
    parts.push(variant === 'summary' ? red(text) : yellow(text));
  }
  return `  ${displayLabel}  (${parts.join(', ')})`;
}

function lockLine(n: number, variant: 'removed' | 'kept'): string {
  const label = 'skills-lock.json';
  if (n === 0) return `  ${label}  (not in lock)`;
  if (variant === 'kept') return `  ${green(`${label}  (${plural(n, 'line')} kept)`)}`;
  return `  ${red(`${label}  (${plural(n, 'line')})`)}`;
}

function printBlock(
  targets: SkillTarget[],
  scope: Scope,
  verb: string,
  lockLinesToRemove: number,
  diskVariant: 'plan' | 'summary',
  lockVariant: 'removed' | 'kept',
): void {
  console.log(header(targets, verb));
  const singleName = targets.length === 1 ? targets[0]?.name : undefined;
  if (scope === 'all' || scope === 'agents-only') {
    console.log(
      diskLine(
        '.agents/skills',
        singleName,
        targets.map((t) => t.agents),
        diskVariant,
      ),
    );
  }
  if (scope === 'all' || scope === 'claude-only') {
    console.log(
      diskLine(
        '.claude/skills',
        singleName,
        targets.map((t) => t.claude),
        diskVariant,
      ),
    );
  }
  if (scope === 'all' || scope === 'lock-only') {
    console.log(lockLine(lockLinesToRemove, lockVariant));
  }
}

export const removeCommand = defineCommand({
  meta: {
    description: 'Remove one or more skills from on-disk dirs and/or skills-lock.json',
  },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
    yes: { type: 'boolean', alias: 'y', default: false, description: 'Skip confirmation prompts' },
    'lock-only': {
      type: 'boolean',
      alias: 'lo',
      default: false,
      description: 'Only remove the skills-lock.json entry; keep on-disk directories',
    },
    'agents-only': {
      type: 'boolean',
      alias: 'ao',
      default: false,
      description: 'Only remove from .agents/skills; keep .claude/skills and the lock entry',
    },
    'claude-only': {
      type: 'boolean',
      alias: 'co',
      default: false,
      description: 'Only remove from .claude/skills; keep .agents/skills and the lock entry',
    },
  },
  async run({ args }) {
    const {
      global: isGlobal,
      yes,
      'lock-only': lockOnly,
      'agents-only': agentsOnly,
      'claude-only': claudeOnly,
    } = args;

    const onlyFlagCount = [lockOnly, agentsOnly, claudeOnly].filter(Boolean).length;
    if (onlyFlagCount > 1) {
      console.error('--lock-only, --agents-only, and --claude-only are mutually exclusive');
      process.exit(1);
    }
    const scope: Scope = lockOnly
      ? 'lock-only'
      : agentsOnly
        ? 'agents-only'
        : claudeOnly
          ? 'claude-only'
          : 'all';

    const subcmdIdx = process.argv.findIndex((a) => a === 'remove' || a === 'rm');
    const rawNames = process.argv.slice(subcmdIdx + 1).filter((a) => !a.startsWith('-'));
    const all = rawNames.includes('.');
    const names = rawNames.filter((n) => n !== '.');

    if (all && names.length > 0) {
      console.error('"." (all skills) is mutually exclusive with positional skill names');
      process.exit(1);
    }

    if (!all && names.length === 0) {
      console.error('No skill names provided');
      process.exit(1);
    }

    const lockPath = getLockPath(isGlobal);

    const targets: SkillTarget[] = all
      ? collectAllTargets(isGlobal, lockPath)
      : names.map((n) => buildTarget(n, isGlobal, lockPath));

    if (all && targets.length === 0) {
      console.log('No skills to remove in scope.');
      return;
    }

    const lockNames = new Set(Object.keys(readLock(lockPath).skills));
    const orphan = targets.filter(
      (t) => t.agents.kind === 'missing' && t.claude.kind === 'missing' && !lockNames.has(t.name),
    );
    if (orphan.length) {
      for (const o of orphan) console.log(`"${o.name}" is not in lock or on disk`);
      process.exit(1);
    }

    const lockLinesToRemove = countLockLinesToRemove(
      lockPath,
      targets.map((t) => t.name),
    );

    printBlock(targets, scope, 'will be removed from:', lockLinesToRemove, 'plan', 'removed');

    const ask = createConfirmer();

    if (!yes) {
      const ok = await ask('Proceed?');
      if (!ok) {
        console.log('Aborted');
        process.exit(1);
      }
    }

    const allowedRoots = [isGlobal ? homedir() : dirname(resolve(lockPath)), homedir()];

    if (scope === 'all' || scope === 'agents-only') {
      for (const t of targets) rmSkillDir(t.agentsDir, { allowedRoots });
    }
    if (scope === 'all' || scope === 'claude-only') {
      for (const t of targets) rmSkillDir(t.claudeDir, { allowedRoots });
    }

    let lockCleaned = false;
    if (scope === 'lock-only') {
      for (const t of targets) removeSkillFromLock(lockPath, t.name);
      lockCleaned = true;
    } else if (scope === 'all' && lockLinesToRemove > 0) {
      const cleanLock =
        yes || (await ask(`Clean skills-lock.json (${plural(lockLinesToRemove, 'line')})?`));
      if (cleanLock) {
        for (const t of targets) removeSkillFromLock(lockPath, t.name);
        lockCleaned = true;
      }
    }

    console.log('');
    printBlock(
      targets,
      scope,
      'removed from:',
      lockLinesToRemove,
      'summary',
      lockCleaned ? 'removed' : 'kept',
    );
  },
});
