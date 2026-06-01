import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { getLockPath, readLock, removeSkillFromLock } from '../lock/file';
import { cyan, green, red, yellow } from '../utils/ansi';
import { confirm } from '../utils/confirm';
import { discoverSkills } from '../utils/discover-skills';
import { rmSkillDir } from '../utils/fs-rm';

interface SkillTarget {
  name: string;
  inLock: boolean;
  claudeDir?: string;
  agentsDir?: string;
}

interface DeletePlan {
  target: SkillTarget;
  claudeFileCount?: number;
  agentsFileCount?: number;
}

const q = (name: string) => `"${cyan(name)}"`;

function buildTarget(name: string, isGlobal: boolean, lockPath: string): SkillTarget {
  const lock = readLock(lockPath);
  const inLock = Object.hasOwn(lock.skills, name);
  const baseClaude = isGlobal
    ? join(homedir(), '.claude', 'skills')
    : join(dirname(resolve(lockPath)), '.claude', 'skills');
  const baseAgents = isGlobal
    ? join(homedir(), '.agents', 'skills')
    : join(dirname(resolve(lockPath)), '.agents', 'skills');
  const claudeDir = existsSync(join(baseClaude, name)) ? join(baseClaude, name) : undefined;
  const agentsDir = existsSync(join(baseAgents, name)) ? join(baseAgents, name) : undefined;
  return { name, inLock, claudeDir, agentsDir };
}

function collectAllTargets(isGlobal: boolean, lockPath: string): SkillTarget[] {
  const map = discoverSkills({ isGlobal, cwd: process.cwd(), lockPath });
  return [...map.keys()].sort().map((name) => buildTarget(name, isGlobal, lockPath));
}

function fileCount(dir: string): number {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  let n = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    const stat = statSync(cur);
    if (stat.isFile()) n++;
    else if (stat.isDirectory()) for (const e of readdirSync(cur)) stack.push(join(cur, e));
  }
  return n;
}

function printPlan(plan: DeletePlan, modifyLock: boolean, lockOnly: boolean): void {
  const { target } = plan;
  console.log(`Will remove ${q(target.name)}:`);
  if (target.inLock) {
    if (lockOnly || modifyLock) console.log('  - skills-lock.json');
    else console.log('  - skills-lock.json (kept; use --force-lock to remove lock entry)');
  } else {
    console.log('  - skills-lock.json (not in lock)');
  }
  if (lockOnly) {
    if (target.claudeDir) console.log(`  - .claude/skills/${target.name}/  (kept; --lock-only)`);
    else console.log('  - .claude/skills/  (not found)');
    if (target.agentsDir) console.log(`  - .agents/skills/${target.name}/  (kept; --lock-only)`);
    else console.log('  - .agents/skills/  (not found)');
    return;
  }
  if (target.claudeDir)
    console.log(`  - .claude/skills/${target.name}/  (${plan.claudeFileCount} files)`);
  else console.log('  - .claude/skills/  (not found)');
  if (target.agentsDir)
    console.log(`  - .agents/skills/${target.name}/  (${plan.agentsFileCount} files)`);
  else console.log('  - .agents/skills/  (not found)');
}

export const removeCommand = defineCommand({
  meta: {
    description: 'Remove one or more skills from on-disk dirs (lock preserved unless --force-lock)',
  },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
    'dry-run': { type: 'boolean', default: false, description: 'Print plan, do not delete' },
    yes: { type: 'boolean', alias: 'y', default: false, description: 'Skip confirmation prompt' },
    'force-lock': {
      type: 'boolean',
      default: false,
      description: 'Also remove entry from skills-lock.json (default is to keep lock untouched)',
    },
    'lock-only': {
      type: 'boolean',
      default: false,
      description: 'Remove only the skills-lock.json entry; keep on-disk directories',
    },
  },
  async run({ args }) {
    const {
      global: isGlobal,
      'dry-run': dryRun,
      yes,
      'force-lock': modifyLock,
      'lock-only': lockOnly,
    } = args;

    if (lockOnly && modifyLock) {
      console.error('--lock-only is mutually exclusive with --force-lock');
      process.exit(1);
    }

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

    const orphan = targets.filter((t) => !t.inLock && !t.claudeDir && !t.agentsDir);
    if (orphan.length) {
      for (const o of orphan) console.log(`${q(o.name)} is not in lock or on disk`);
      process.exit(1);
    }

    const plans: DeletePlan[] = targets.map((t) => ({
      target: t,
      claudeFileCount: t.claudeDir ? fileCount(t.claudeDir) : undefined,
      agentsFileCount: t.agentsDir ? fileCount(t.agentsDir) : undefined,
    }));

    for (const p of plans) {
      printPlan(p, modifyLock, lockOnly);
      console.log('');
    }

    if (dryRun) return;

    if (!yes) {
      let question = 'Proceed?';
      if (all) {
        const subject = lockOnly
          ? `ALL ${plans.length} lock entries (disk preserved)`
          : `ALL ${plans.length} skills`;
        question = `Remove ${subject}?`;
      }
      const ok = await confirm(question);
      if (!ok) {
        console.log('Aborted');
        process.exit(1);
      }
    }

    const allowedRoots = [isGlobal ? homedir() : dirname(resolve(lockPath)), homedir()];

    const removed = (s: string) => red('removed') + s;
    const kept = (s: string) => green('kept') + s;
    const skipped = (s: string) => yellow('skipped') + s;

    for (const { target } of plans) {
      console.log('');
      console.log(q(target.name));

      if (lockOnly) {
        if (target.agentsDir) console.log(kept(' .agents/skills (--lock-only)'));
        else console.log(skipped(' .agents/skills (not found)'));
        if (target.claudeDir) console.log(kept(' .claude/skills (--lock-only)'));
        else console.log(skipped(' .claude/skills (not found)'));
      } else {
        if (target.agentsDir) {
          const r = rmSkillDir(target.agentsDir, { allowedRoots });
          console.log(removed(` from .agents/skills (${r.fileCount} files)`));
        } else {
          console.log(skipped(' .agents/skills (not found)'));
        }
        if (target.claudeDir) {
          const r = rmSkillDir(target.claudeDir, { allowedRoots });
          console.log(removed(` from .claude/skills (${r.fileCount} files)`));
        } else {
          console.log(skipped(' .claude/skills (not found)'));
        }
      }

      if (target.inLock) {
        if (lockOnly || modifyLock) {
          const r = removeSkillFromLock(lockPath, target.name);
          if (r.removed) console.log(removed(' from skills-lock.json'));
        } else {
          console.log(kept(' in skills-lock.json'));
        }
      } else {
        console.log(skipped(' skills-lock.json (not in lock)'));
      }
    }
  },
});
