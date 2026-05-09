import { defineCommand } from 'citty';
import { getLockPath, readLock } from '../lock/file';

export const listCommand = defineCommand({
  meta: { description: 'List skills in the lock file' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
    json: { type: 'boolean', default: false, description: 'Output as JSON array' },
  },
  run({ args }) {
    const path = getLockPath(args.global);
    const lock = readLock(path);
    const skills = Object.keys(lock.skills).sort();

    if (args.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }

    if (skills.length === 0) {
      console.log(`No skills in ${path}`);
      return;
    }

    for (const skill of skills) console.log(skill);
    console.log('');
    console.log(`Total: ${skills.length} skill${skills.length === 1 ? '' : 's'} in ${path}`);
  },
});
