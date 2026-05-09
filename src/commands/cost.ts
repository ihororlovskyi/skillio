import { defineCommand } from 'citty';
import { getLockPath, readLock } from '../lock/file';
import { countFrontmatterTokens, findSkillFile } from '../utils/skill-files';

interface Row {
  skill: string;
  tokens: number | 'missing' | 'no-frontmatter';
}

export const costCommand = defineCommand({
  meta: {
    description: 'Estimate ambient token cost (frontmatter) of each skill in the lock file',
  },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
  },
  run({ args }) {
    const lockPath = getLockPath(args.global);
    const lock = readLock(lockPath);
    const names = Object.keys(lock.skills).sort();

    const rows: Row[] = names.map((skill) => {
      const file = findSkillFile(skill, lockPath, args.global);
      if (!file) return { skill, tokens: 'missing' };
      const tokens = countFrontmatterTokens(file);
      if (tokens === undefined) return { skill, tokens: 'no-frontmatter' };
      return { skill, tokens };
    });

    if (args.json) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }

    if (rows.length === 0) {
      console.log(`No skills in ${lockPath}`);
      return;
    }

    const nameWidth = Math.max(...rows.map((r) => r.skill.length));
    let total = 0;
    let missing = 0;
    for (const r of rows) {
      let cell: string;
      if (typeof r.tokens === 'number') {
        cell = `~${r.tokens} tok`;
        total += r.tokens;
      } else if (r.tokens === 'missing') {
        cell = 'missing';
        missing += 1;
      } else {
        cell = '(no frontmatter)';
      }
      console.log(`${r.skill.padEnd(nameWidth)}  ${cell}`);
    }

    console.log('');
    const tail = missing > 0 ? ` (${missing} missing)` : '';
    console.log(`Total: ~${total} tok across ${rows.length} skills${tail}`);
  },
});
