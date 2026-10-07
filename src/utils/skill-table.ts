// src/utils/skill-table.ts
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { bold, green, red, yellow } from './ansi';

export type Install = 'real' | 'symlink' | 'broken';

export interface SkillRoots {
  agents: string;
  claude: string;
}

export interface SkillRow {
  name: string;
  agents?: Install;
  claude?: Install;
  inLock: boolean;
}

export function getInstall(root: string, name: string): Install | undefined {
  const dir = join(root, name);
  // lstat (not existsSync) so a dangling symlink is classified as 'broken', not absent
  const stat = lstatSync(dir, { throwIfNoEntry: false });
  if (!stat) return undefined;
  if (stat.isSymbolicLink()) return existsSync(dir) ? 'symlink' : 'broken';
  return 'real';
}

export function collectRows(
  names: Iterable<string>,
  roots: SkillRoots,
  lockNames: Set<string>,
): SkillRow[] {
  return [...new Set(names)]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      agents: getInstall(roots.agents, name),
      claude: getInstall(roots.claude, name),
      inLock: lockNames.has(name),
    }));
}

interface Cell {
  text: string;
  paint: (s: string) => string;
}

const plain = (text: string): Cell => ({ text, paint: (s) => s });

// a real folder in .agents/skills is the canonical copy of `npx skills`; in .claude/skills it is a copy
function installCell(install: Install | undefined, realLabel: string): Cell {
  if (install === 'real') return { text: realLabel, paint: green };
  if (install === 'symlink') return { text: 'symlinked', paint: yellow };
  if (install === 'broken') return { text: 'broken', paint: red };
  return plain('-');
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function renderSkillTable(
  rows: SkillRow[],
  opts: { lockLabel: string; total: boolean },
): string[] {
  const header = ['skill', '.agents', '.claude', opts.lockLabel].map((text) => ({
    text,
    paint: bold,
  }));
  const body = rows.map((r) => {
    const orphan = r.inLock && !r.agents && !r.claude;
    const lock: Cell = r.inLock ? { text: '+', paint: orphan ? red : (s) => s } : plain('-');
    return [
      plain(r.name),
      installCell(r.agents, 'universal'),
      installCell(r.claude, 'copied'),
      lock,
    ];
  });
  const lines: Cell[][] = [header, ...body];
  if (opts.total) {
    const count = (has: (r: SkillRow) => boolean) => plain(String(rows.filter(has).length));
    lines.push([
      plain(plural(rows.length, 'skill')),
      count((r) => r.agents !== undefined),
      count((r) => r.claude !== undefined),
      count((r) => r.inLock),
    ]);
  }
  // pad by the uncolored text so ANSI codes do not break the alignment
  const widths = [0, 1, 2].map((i) => Math.max(...lines.map((l) => l[i]?.text.length ?? 0)));
  return lines.map((cells) =>
    cells
      .map((c, i) => c.paint(c.text) + ' '.repeat(i < 3 ? (widths[i] ?? 0) - c.text.length : 0))
      .join('  ')
      .trimEnd(),
  );
}
