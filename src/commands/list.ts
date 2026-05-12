import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { cyan } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';

interface SourceRow {
  label: string;
  names: string[];
  tokens: number;
  exists: boolean; // false → omit row
}

function bySource(records: SkillRecord[]): {
  claude: SourceRow;
  agents: SourceRow;
  lock: SourceRow;
} {
  const claudeNames = records
    .filter((r) => r.sources.includes('.claude'))
    .map((r) => r.name)
    .sort();
  const agentsNames = records
    .filter((r) => r.sources.includes('.agents'))
    .map((r) => r.name)
    .sort();
  const lockNames = records
    .filter((r) => r.sources.includes('lock'))
    .map((r) => r.name)
    .sort();
  const sumTokens = (names: string[]) =>
    names.reduce((acc, n) => acc + (records.find((r) => r.name === n)?.frontmatterTokens ?? 0), 0);
  return {
    claude: {
      label: '.claude/skills',
      names: claudeNames,
      tokens: sumTokens(claudeNames),
      exists: true,
    },
    agents: {
      label: '.agents/skills',
      names: agentsNames,
      tokens: sumTokens(agentsNames),
      exists: true,
    },
    lock: {
      label: 'skills-lock.json',
      names: lockNames,
      tokens: sumTokens(lockNames),
      exists: true,
    },
  };
}

function agentsDirExists(isGlobal: boolean, lockPath: string): boolean {
  if (isGlobal) {
    return existsSync(join(process.env.HOME ?? '', '.agents', 'skills'));
  }
  return existsSync(join(dirname(resolve(lockPath)), '.agents', 'skills'));
}

export const listCommand = defineCommand({
  meta: { description: 'List skills per source with totals and lock-vs-disk diff' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const map = discoverSkills({ isGlobal: args.global, cwd: process.cwd(), lockPath });
    const records = [...map.values()];
    const rows = bySource(records);
    const showAgents = agentsDirExists(args.global, lockPath) || rows.agents.names.length > 0;

    const claudeNames = rows.claude.names;
    const agentsNames = rows.agents.names;
    const lockNames = rows.lock.names;

    const lockOnly = lockNames.filter((n) => !claudeNames.includes(n) && !agentsNames.includes(n));
    const claudeNotInLock = claudeNames.filter((n) => !lockNames.includes(n));
    const agentsNotInLock = agentsNames.filter((n) => !lockNames.includes(n));

    const sourceRows: SourceRow[] = [rows.claude];
    if (showAgents) sourceRows.push(rows.agents);
    sourceRows.push(rows.lock);

    const labelWidth = Math.max(...sourceRows.map((r) => r.label.length));
    const countCells = sourceRows.map((r) =>
      r.names.length === 0
        ? '(empty)'
        : `${r.names.length} skill${r.names.length === 1 ? '' : 's'}`,
    );
    const countWidth = Math.max(...countCells.map((c) => c.length));

    for (let i = 0; i < sourceRows.length; i++) {
      const row = sourceRows[i];
      if (!row) continue;
      const countCell = countCells[i] ?? '';
      const namesText = row.names.length ? row.names.map(cyan).join(' ') : '';
      const line = `${row.label.padEnd(labelWidth)} : ${countCell.padEnd(countWidth)}${
        namesText ? ` : ${namesText}` : ''
      }`;
      console.log(line.trimEnd());
    }

    const diffs: string[] = [];
    if (lockOnly.length) {
      diffs.push(
        `skills-lock.json has ${lockOnly.length} skill${lockOnly.length === 1 ? '' : 's'} missing on disk: ${lockOnly.map(cyan).join(', ')}`,
      );
    }
    if (claudeNotInLock.length) {
      diffs.push(
        `.claude/skills has ${claudeNotInLock.length} skill${claudeNotInLock.length === 1 ? '' : 's'} not in lock: ${claudeNotInLock.map(cyan).join(', ')}`,
      );
    }
    if (agentsNotInLock.length) {
      diffs.push(
        `.agents/skills has ${agentsNotInLock.length} skill${agentsNotInLock.length === 1 ? '' : 's'} not in lock: ${agentsNotInLock.map(cyan).join(', ')}`,
      );
    }
    if (diffs.length) {
      console.log('');
      for (const line of diffs) console.log(line);
    }
  },
});
