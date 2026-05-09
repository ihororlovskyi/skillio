import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { detectColorSupport, green, red, setColorEnabled, yellow } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';

type Verdict = 'ok' | 'plan' | 'cleanup';

interface JsonRow {
  name: string;
  tokens?: number;
  status: SkillRecord['status'];
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
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
    'no-color': { type: 'boolean', default: false, description: 'Disable ANSI colors' },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const map = discoverSkills({ isGlobal: args.global, cwd: process.cwd(), lockPath });
    const rows = sortRows([...map.values()]);
    const total = rows.reduce((acc, r) => acc + (r.frontmatterTokens ?? 0), 0);
    const { verdict, message, paint } = classify(total);

    if (args.json) {
      const out = {
        skills: rows.map<JsonRow>((r) => ({
          name: r.name,
          tokens: r.frontmatterTokens,
          status: r.status,
        })),
        total,
        verdict,
      };
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    setColorEnabled(detectColorSupport({ noColorFlag: args['no-color'] }));

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
