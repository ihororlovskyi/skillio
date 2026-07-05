import { existsSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { cyan, green, red, yellow } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';

type Install = 'real' | 'symlink';

interface NameWithInstall {
  name: string;
  install?: Install;
}

interface SourceRow {
  label: string;
  names: NameWithInstall[];
  totalCount: number;
}

function rootFor(isGlobal: boolean, lockPath: string, kind: '.claude' | '.agents'): string {
  if (isGlobal) return join(homedir(), kind, 'skills');
  return join(dirname(resolve(lockPath)), kind, 'skills');
}

function getInstall(root: string, name: string): Install | undefined {
  const dir = join(root, name);
  if (!existsSync(dir)) return undefined;
  return lstatSync(dir).isSymbolicLink() ? 'symlink' : 'real';
}

function paintDisk(n: NameWithInstall): string {
  if (n.install === 'symlink') return yellow(n.name);
  if (n.install === 'real') return green(n.name);
  return cyan(n.name);
}

function bySource(
  records: SkillRecord[],
  roots: { claude: string; agents: string },
  lockLabel: string,
): { agents: SourceRow; claude: SourceRow; lock: SourceRow } {
  const claudeRecords = records.filter((r) => r.sources.includes('.claude'));
  const agentsRecords = records.filter((r) => r.sources.includes('.agents'));
  const lockRecords = records.filter((r) => r.sources.includes('lock'));

  const claudeNames: NameWithInstall[] = claudeRecords
    .map((r) => ({ name: r.name, install: getInstall(roots.claude, r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const agentsNames: NameWithInstall[] = agentsRecords
    .map((r) => ({ name: r.name, install: getInstall(roots.agents, r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lockNames: NameWithInstall[] = lockRecords
    .map((r) => ({ name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    agents: { label: '.agents/skills', names: agentsNames, totalCount: agentsNames.length },
    claude: { label: '.claude/skills', names: claudeNames, totalCount: claudeNames.length },
    lock: { label: lockLabel, names: lockNames, totalCount: lockNames.length },
  };
}

export const listCommand = defineCommand({
  meta: { description: 'List skills per source with install-type coloring and lock orphan filter' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
    names: {
      type: 'boolean',
      default: false,
      description: 'Print one skill name per line (no header, no colors) — for completion scripts',
    },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const records = [
      ...discoverSkills({ isGlobal: args.global, cwd: process.cwd(), lockPath }).values(),
    ];
    const roots = {
      claude: rootFor(args.global, lockPath, '.claude'),
      agents: rootFor(args.global, lockPath, '.agents'),
    };
    const lockLabel = args.global ? '.agents/.skill-lock.json' : 'skills-lock.json';
    const rows = bySource(records, roots, lockLabel);

    if (args.names) {
      const all = new Set<string>();
      for (const n of rows.agents.names) all.add(n.name);
      for (const n of rows.claude.names) all.add(n.name);
      for (const n of rows.lock.names) all.add(n.name);
      for (const name of [...all].sort()) console.log(name);
      return;
    }

    console.log(args.global ? 'Global' : 'Local');

    const claudeSet = new Set(rows.claude.names.map((n) => n.name));
    const agentsSet = new Set(rows.agents.names.map((n) => n.name));
    const orphans = rows.lock.names.filter((n) => !claudeSet.has(n.name) && !agentsSet.has(n.name));

    const sourceRows: Array<{ row: SourceRow; render: () => string }> = [
      {
        row: rows.agents,
        render: () => rows.agents.names.map(paintDisk).join(' '),
      },
      {
        row: rows.claude,
        render: () => rows.claude.names.map(paintDisk).join(' '),
      },
      {
        row: rows.lock,
        render: () => {
          if (rows.lock.totalCount === 0) return '';
          const orphanSet = new Set(orphans.map((n) => n.name));
          return rows.lock.names
            .map((n) => (orphanSet.has(n.name) ? red(n.name) : n.name))
            .join(' ');
        },
      },
    ];

    const labelWidth = Math.max(...sourceRows.map((r) => r.row.label.length));
    const countCells = sourceRows.map(
      (r) => `${r.row.totalCount} skill${r.row.totalCount === 1 ? '' : 's'}`,
    );
    const countWidth = Math.max(...countCells.map((c) => c.length));

    for (let i = 0; i < sourceRows.length; i++) {
      const entry = sourceRows[i];
      if (!entry) continue;
      const countCell = countCells[i] ?? '';
      const namesText = entry.render();
      const line = `${entry.row.label.padEnd(labelWidth)} : ${countCell.padEnd(countWidth)}${
        namesText ? ` : ${namesText}` : ''
      }`;
      console.log(line.trimEnd());
    }

    const claudeNames = rows.claude.names.map((n) => n.name);
    const agentsNames = rows.agents.names.map((n) => n.name);
    const lockNames = rows.lock.names.map((n) => n.name);
    const claudeNotInLock = claudeNames.filter((n) => !lockNames.includes(n));
    const agentsNotInLock = agentsNames.filter((n) => !lockNames.includes(n));

    const diffs: string[] = [];
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
