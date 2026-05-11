import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { green, red, yellow } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';

type Verdict = 'ok' | 'plan' | 'cleanup';

interface SourceRow {
  label: string;
  count: number;
  tokens: number;
}

interface Section {
  title: 'Global' | 'Local';
  rows: SourceRow[];
  totalCount: number;
  totalTokens: number;
}

function classify(total: number): {
  verdict: Verdict;
  message: string;
  paint: (s: string) => string;
} {
  if (total < 1000) return { verdict: 'ok', message: 'OK — keep it lean', paint: green };
  if (total <= 1500)
    return { verdict: 'plan', message: 'time to plan some cleanup', paint: yellow };
  return { verdict: 'cleanup', message: 'ballast — clean it up', paint: red };
}

function bucketTokens(records: SkillRecord[], source: SkillRecord['sources'][number]): number {
  return records
    .filter((r) => r.sources.includes(source))
    .reduce((acc, r) => acc + (r.frontmatterTokens ?? 0), 0);
}

function bucketCount(records: SkillRecord[], source: SkillRecord['sources'][number]): number {
  return records.filter((r) => r.sources.includes(source)).length;
}

function buildSection(opts: { isGlobal: boolean; cwd: string; prefix: string }): Section {
  const lockPath = getLockPath(opts.isGlobal);
  const records = [
    ...discoverSkills({ isGlobal: opts.isGlobal, cwd: opts.cwd, lockPath }).values(),
  ];
  const rows: SourceRow[] = [
    {
      label: `${opts.prefix}.claude/skills`,
      count: bucketCount(records, '.claude'),
      tokens: bucketTokens(records, '.claude'),
    },
    {
      label: `${opts.prefix}.agents/skills`,
      count: bucketCount(records, '.agents'),
      tokens: bucketTokens(records, '.agents'),
    },
    {
      label: `${opts.prefix}skills-lock.json`,
      count: bucketCount(records, 'lock'),
      tokens: bucketTokens(records, 'lock'),
    },
  ];
  const totalTokens = records.reduce((acc, r) => acc + (r.frontmatterTokens ?? 0), 0);
  const totalCount = records.length;
  return {
    title: opts.isGlobal ? 'Global' : 'Local',
    rows,
    totalCount,
    totalTokens,
  };
}

function formatRow(row: SourceRow, labelW: number, countW: number, tokenW: number): string {
  const countCell = row.count === 0 ? '(empty)' : `${row.count} skill${row.count === 1 ? '' : 's'}`;
  const tokensCell = `~${row.tokens} tok`;
  return `${row.label.padEnd(labelW)} : ${countCell.padEnd(countW)}  ${tokensCell.padStart(tokenW)}`;
}

function renderSection(section: Section): string[] {
  const labelW = Math.max(...section.rows.map((r) => r.label.length));
  const countCells = section.rows.map((r) =>
    r.count === 0 ? '(empty)' : `${r.count} skill${r.count === 1 ? '' : 's'}`,
  );
  const countW = Math.max(...countCells.map((c) => c.length));
  const tokenW = Math.max(...section.rows.map((r) => `~${r.tokens} tok`.length));
  return [section.title, ...section.rows.map((r) => formatRow(r, labelW, countW, tokenW))];
}

export interface SummaryArgs {
  global: boolean;
}

export function runSummary(args: SummaryArgs): void {
  const cwd = process.cwd();
  const global = buildSection({ isGlobal: true, cwd, prefix: '~/' });
  const local = buildSection({ isGlobal: false, cwd, prefix: '' });

  const lines: string[] = [];
  lines.push(...renderSection(global));
  lines.push('');
  lines.push(...renderSection(local));
  lines.push('');

  const grandTokens = global.totalTokens + local.totalTokens;
  const grandCount = global.totalCount + local.totalCount;
  const { message, paint } = classify(grandTokens);
  lines.push(`Total: ${grandCount} skills  ~${grandTokens} tok    ${paint(message)}`);

  // suppress unused warning until we need it
  void args;
  console.log(lines.join('\n'));
}

export const summaryCommand = defineCommand({
  meta: { description: 'Show skill counts and tokens across global + local sources' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
  },
  run({ args }) {
    runSummary({ global: args.global });
  },
});
