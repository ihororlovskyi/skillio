import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { getLockPath, readLock, removeSkillFromLock } from '../lock/file';
import { confirm } from '../utils/confirm';
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

function fileCount(dir: string): number {
  // mirror rmSkillDir's countFiles, but read-only
  // simpler: use rmSkillDir's logic indirectly by listing
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

function printPlan(plan: DeletePlan): void {
  const { target } = plan;
  console.log(`Will remove "${target.name}":`);
  if (target.inLock) console.log('  - skills-lock.json');
  else console.log('  - skills-lock.json (not in lock)');
  if (target.claudeDir)
    console.log(`  - .claude/skills/${target.name}/  (${plan.claudeFileCount} files)`);
  else console.log('  - .claude/skills/  (not found)');
  if (target.agentsDir)
    console.log(`  - .agents/skills/${target.name}/  (${plan.agentsFileCount} files)`);
  else console.log('  - .agents/skills/  (not found)');
}

export const removeCommand = defineCommand({
  meta: { description: 'Remove one or more skills from lock and delete their on-disk directories' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
    'dry-run': { type: 'boolean', default: false, description: 'Print plan, do not delete' },
    yes: { type: 'boolean', alias: 'y', default: false, description: 'Skip confirmation prompt' },
  },
  async run({ args }) {
    const { global: isGlobal, 'dry-run': dryRun, yes } = args;

    const subcmdIdx = process.argv.findIndex((a) => a === 'remove' || a === 'rm');
    const names = process.argv.slice(subcmdIdx + 1).filter((a) => !a.startsWith('-'));

    if (names.length === 0) {
      console.error('No skill names provided');
      process.exit(1);
    }

    const lockPath = getLockPath(isGlobal);
    const targets = names.map((n) => buildTarget(n, isGlobal, lockPath));

    const orphan = targets.filter((t) => !t.inLock && !t.claudeDir && !t.agentsDir);
    if (orphan.length) {
      for (const o of orphan) console.log(`"${o.name}" is not in lock or on disk`);
      process.exit(1);
    }

    const plans: DeletePlan[] = targets.map((t) => ({
      target: t,
      claudeFileCount: t.claudeDir ? fileCount(t.claudeDir) : undefined,
      agentsFileCount: t.agentsDir ? fileCount(t.agentsDir) : undefined,
    }));

    for (const p of plans) {
      printPlan(p);
      console.log('');
    }

    if (dryRun) return;

    if (!yes) {
      const ok = await confirm('Proceed?');
      if (!ok) {
        console.log('Aborted');
        process.exit(1);
      }
    }

    const allowedRoots = [
      isGlobal ? homedir() : dirname(resolve(lockPath)),
      homedir(), // also allow ~/.claude and ~/.agents in repo-mode deletes if user pointed there
    ];

    for (const { target } of plans) {
      if (target.inLock) {
        const r = removeSkillFromLock(lockPath, target.name);
        if (r.removed) console.log(`Removed "${target.name}" from skills-lock.json`);
      } else {
        console.log(`Skipped skills-lock.json (not in lock)`);
      }
      if (target.claudeDir) {
        const r = rmSkillDir(target.claudeDir, { allowedRoots });
        console.log(`Removed "${target.name}" from .claude/skills (${r.fileCount} files)`);
      } else {
        console.log('Skipped .claude/skills (not found)');
      }
      if (target.agentsDir) {
        const r = rmSkillDir(target.agentsDir, { allowedRoots });
        console.log(`Removed "${target.name}" from .agents/skills (${r.fileCount} files)`);
      } else {
        console.log('Skipped .agents/skills (not found)');
      }
    }
  },
});
