import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { green, red, yellow } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';

type Verdict = 'ok' | 'plan' | 'cleanup';

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

function sortRows(records: SkillRecord[]): SkillRecord[] {
  const ok = records.filter((r) => r.status === 'ok');
  const rest = records.filter((r) => r.status !== 'ok');
  ok.sort(
    (a, b) =>
      (b.frontmatterTokens ?? 0) - (a.frontmatterTokens ?? 0) || a.name.localeCompare(b.name),
  );
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [...ok, ...rest];
}

export const costCommand = defineCommand({
  meta: { description: 'Show ambient ballast cost (per-skill frontmatter tokens) sorted desc' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const map = discoverSkills({ isGlobal: args.global, cwd: process.cwd(), lockPath });
    const rows = sortRows([...map.values()]);
    const total = rows.reduce((acc, r) => acc + (r.frontmatterTokens ?? 0), 0);
    const { message, paint } = classify(total);

    console.log(args.global ? 'Global' : 'Local');
    console.log('');

    if (rows.length === 0) {
      console.log(`No skills in ${lockPath}`);
      return;
    }

    const nameWidth = Math.max(...rows.map((r) => r.name.length));
    for (const r of rows) {
      let cell: string;
      if (r.status === 'ok') cell = `~${r.frontmatterTokens} tok`;
      else if (r.status === 'missing') cell = 'missing';
      else cell = '(no frontmatter)';
      console.log(`${r.name.padEnd(nameWidth)}  ${cell}`);
    }
    console.log('');
    console.log(`Total: ~${total} tok across ${rows.length} skills    ${paint(message)}`);
  },
});
