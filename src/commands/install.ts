import { spawnSync } from 'node:child_process';

export interface SpawnOutcome {
  status: number | null;
  error?: Error;
}

export type Spawner = (command: string, args: string[]) => SpawnOutcome;

// Node >= 20 refuses to spawn npx.cmd without a shell on Windows (EINVAL)
const defaultSpawn: Spawner = (command, args) =>
  spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });

export const INSTALL_HELP = [
  'Install published skills: runs `npx -y skills add` with the same arguments.',
  '',
  'USAGE skillio install <source> [OPTIONS]',
  '       skillio i <source> [OPTIONS]',
  '',
  'Every argument is passed to `npx skills add` unchanged; see `npx skills add --help`.',
  'A local path is copied by `npx skills add`; use `skl symlink` to symlink a local clone.',
  '',
  'EXAMPLES',
  '',
  '  skl i sentimony/skills -s cross-review tdd -a codex claude-code -y',
  '  skl i sentimony/skills -l',
].join('\n');

export function runInstall(argv: string[], spawn: Spawner = defaultSpawn): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(INSTALL_HELP);
    return 0;
  }
  const r = spawn('npx', ['-y', 'skills', 'add', ...argv]);
  if (r.error || r.status === null) {
    console.error(`skl install: failed to run npx${r.error ? `: ${r.error.message}` : ''}`);
    return 1;
  }
  return r.status;
}
