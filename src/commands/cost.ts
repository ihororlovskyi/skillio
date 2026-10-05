import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { cyan, red } from '../utils/ansi';
import { discoverSkills, type SkillRecord } from '../utils/discover-skills';
import { scopeHeader } from '../utils/scope';

function inContext(r: SkillRecord): boolean {
  return r.status === 'ok' && !r.disableModelInvocation;
}

function sortRows(records: SkillRecord[]): SkillRecord[] {
  const ok = records.filter(inContext);
  const rest = records.filter((r) => !inContext(r));
  ok.sort(
    (a, b) =>
      (b.frontmatterTokens ?? 0) - (a.frontmatterTokens ?? 0) || a.name.localeCompare(b.name),
  );
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [...ok, ...rest];
}

export const costCommand = defineCommand({
  meta: {
    description: 'Show ambient context cost (per-skill name + description tokens) sorted desc',
  },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global scope' },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const map = discoverSkills({ isGlobal: args.global, cwd: process.cwd(), lockPath });
    const rows = sortRows([...map.values()]);
    const total = rows.filter(inContext).reduce((acc, r) => acc + (r.frontmatterTokens ?? 0), 0);

    console.log(scopeHeader(args.global));

    if (rows.length === 0) {
      console.log(`No skills in ${lockPath}`);
      return;
    }

    const nameWidth = Math.max(...rows.map((r) => r.name.length));
    const tokenCells = rows.map((r) => {
      if (r.status === 'missing') return '~? tok';
      if (r.status === 'no-frontmatter') return '(no frontmatter)';
      // disable-model-invocation: not in Claude Code's always-loaded context
      return r.disableModelInvocation ? '-' : `~${r.frontmatterTokens} tok`;
    });
    const tokenWidth = Math.max(...tokenCells.map((c) => c.length));
    rows.forEach((r, i) => {
      const tokenCell = tokenCells[i] ?? '';
      const suffix = r.status === 'missing' ? `  ${red('missing')}` : '';
      const namePad = ' '.repeat(nameWidth - r.name.length);
      const tokenPad = suffix ? ' '.repeat(tokenWidth - tokenCell.length) : '';
      console.log(`${cyan(r.name)}${namePad}  ${tokenCell}${tokenPad}${suffix}`);
    });
    console.log(
      `Total: ~${total} tok across ${rows.length} skills  ·  method: chars/3, name+description`,
    );
  },
});
