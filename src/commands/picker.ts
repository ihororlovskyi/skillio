import { spawnSync } from 'node:child_process';
import { getLockPath } from '../lock/file';
import { red } from '../utils/ansi';
import { listRemovableTargets } from '../utils/list-removable';
import { multiSelect, select } from '../utils/prompt';

export interface PickerArgs {
  global: boolean;
}

async function pickRemoveTargets(args: PickerArgs): Promise<string[] | null> {
  const lockPath = getLockPath(args.global);
  const { inLock, orphan } = listRemovableTargets({
    isGlobal: args.global,
    cwd: process.cwd(),
    lockPath,
  });

  if (inLock.length === 0 && orphan.length === 0) {
    console.log('No skills found in scope.');
    return [];
  }

  const options = [
    ...inLock.map((name) => ({ value: name, label: name })),
    ...orphan.map((name) => ({ value: name, label: `${name} ${red('(orphan)')}` })),
  ];

  return await multiSelect({
    title: 'skillio — pick skills to remove (Space toggle, Enter confirm)',
    options,
  });
}

export async function runPicker(args: PickerArgs): Promise<number> {
  const choice = await select({
    title: 'skillio — pick a command',
    options: [
      { value: 'usage', label: 'usage  — count of skill invocations' },
      { value: 'cost', label: 'cost   — per-skill ambient tokens' },
      { value: 'list', label: 'list   — installed skills per source' },
      { value: 'remove', label: 'remove — delete a skill (asks about lock cleanup)' },
      { value: 'quit', label: 'quit' },
    ],
  });

  if (choice === null || choice === 'quit') return 0;

  const cliPath = process.argv[1];
  if (!cliPath) {
    console.error('skillio: cannot resolve CLI path (process.argv[1] missing)');
    return 1;
  }

  let argv: string[];
  if (choice === 'remove') {
    const targets = await pickRemoveTargets(args);
    if (targets === null || targets.length === 0) return 0;
    argv = ['rm', ...targets];
  } else {
    argv = [choice];
  }
  if (args.global) argv.push('-g');

  const r = spawnSync(process.execPath, [cliPath, ...argv], {
    stdio: 'inherit',
    env: process.env,
  });
  return r.status ?? 0;
}
