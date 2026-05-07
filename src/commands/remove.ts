import { defineCommand } from 'citty';
import { getLockPath, readLock, removeSkillFromLock } from '../lock/file';

export const removeCommand = defineCommand({
  meta: { description: 'Remove a skill from the lock file' },
  args: {
    skill: { type: 'positional', description: 'Skill name to remove', required: true },
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
    'dry-run': { type: 'boolean', default: false, description: 'Print without making changes' },
  },
  run({ args }) {
    const { skill, global: isGlobal, 'dry-run': dryRun } = args;
    const path = getLockPath(isGlobal);

    if (dryRun) {
      console.log(`Would remove "${skill}" from ${path}`);
      return;
    }

    const result = removeSkillFromLock(path, skill);

    if (result.removed) {
      console.log(`Removed "${skill}" from ${path}`);
      if (result.backupPath) console.log(`Backup: ${result.backupPath}`);
    } else {
      console.log(`"${skill}" is not in ${path}`);
    }

    const updated = readLock(path);
    console.log(JSON.stringify(Object.keys(updated.skills).sort(), null, 2));
  },
});
