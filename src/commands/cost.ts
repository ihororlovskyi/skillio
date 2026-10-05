import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { cyan, green, red, yellow } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';
import { scopeHeader } from '../utils/scope';

type Verdict = 'ok' | 'plan' | 'cleanup';

function classify(total: number): {
  verdict: Verdict;
  message: string;
  paint: (s: string) => string;
} {
  if (total < 1000) return { verdict: 'ok', message: 'OK - keep it lean', paint: green };
  if (total <= 1500)
    return { verdict: 'plan', message: 'time to plan some cleanup', paint: yellow };
  return { verdict: 'cleanup', message: 'ballast - clean it up', paint: red };
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

    console.log('');
    console.log(scopeHeader(args.global));

    if (rows.length === 0) {
      console.log(`No skills in ${lockPath}`);
      return;
    }

    const nameWidth = Math.max(...rows.map((r) => r.name.length));
    const tokenWidth = Math.max(
      ...rows.map((r) =>
        r.status === 'ok'
          ? `~${r.frontmatterTokens} tok`.length
          : r.status === 'missing'
            ? '~? tok'.length
            : '(no frontmatter)'.length,
      ),
    );
    for (const r of rows) {
      let tokenCell: string;
      let suffix = '';
      if (r.status === 'ok') {
        tokenCell = `~${r.frontmatterTokens} tok`;
      } else if (r.status === 'missing') {
        tokenCell = '~? tok';
        suffix = `  ${red('missing')}`;
      } else {
        tokenCell = '(no frontmatter)';
      }
      const namePad = ' '.repeat(nameWidth - r.name.length);
      const tokenPad = ' '.repeat(Math.max(0, tokenWidth - tokenCell.length));
      console.log(`${cyan(r.name)}${namePad}  ${tokenCell}${tokenPad}${suffix}`);
    }
    console.log('');
    console.log(
      `Total: ~${total} tok across ${rows.length} skills    ${paint(message)}  ·  method: chars/4, yaml-frontmatter`,
    );
  },
});
