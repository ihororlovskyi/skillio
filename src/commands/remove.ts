import { existsSync } from 'node:fs';
import { defineCommand } from 'citty';
import { backupLock, getLockPath, readLock, removeSkillFromLock } from '../lock/file';

export const removeCommand = defineCommand({
  meta: { description: 'Remove one or more skills from the lock file' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
    'dry-run': { type: 'boolean', default: false, description: 'Print without making changes' },
  },
  run({ args }) {
    const { global: isGlobal, 'dry-run': dryRun } = args;

    const subcmdIdx = process.argv.findIndex((a) => a === 'remove' || a === 'rm');
    const skills = process.argv.slice(subcmdIdx + 1).filter((a) => !a.startsWith('-'));

    if (skills.length === 0) {
      console.error('No skill names provided');
      process.exit(1);
    }

    const path = getLockPath(isGlobal);

    if (dryRun) {
      for (const skill of skills) {
        console.log(`Would remove "${skill}" from ${path}`);
      }
      return;
    }

    const backupPath = existsSync(path) ? backupLock(path) : undefined;

    for (const skill of skills) {
      const result = removeSkillFromLock(path, skill, { skipBackup: true });
      if (result.removed) {
        console.log(`Removed "${skill}" from ${path}`);
      } else {
        console.log(`"${skill}" is not in ${path}`);
      }
    }

    if (backupPath) console.log(`Backup: ${backupPath}`);

    const updated = readLock(path);
    console.log(JSON.stringify(Object.keys(updated.skills).sort(), null, 2));
  },
});
