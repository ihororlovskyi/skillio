import { defineCommand } from 'citty';
import { getLockPath, readLock } from '../lock/file';

export const listCommand = defineCommand({
  meta: { description: 'List skills in the lock file' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
  },
  run({ args }) {
    const path = getLockPath(args.global);
    const lock = readLock(path);
    const skills = Object.keys(lock.skills).sort();
    console.log(JSON.stringify(skills, null, 2));
  },
});
