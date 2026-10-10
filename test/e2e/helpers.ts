import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(process.cwd(), 'dist', 'cli.js');

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function run(
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
): RunResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: cwd ?? process.cwd(),
    env: { ...process.env, SKL_X_NO_UPDATE_CHECK: '1', ...env },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// NO_COLOR wins over FORCE_COLOR in detectColorSupport(), so drop an inherited
// NO_COLOR (set by e.g. Codex) or color assertions fail depending on the env.
export function runWithColor(args: string[], cwd?: string): RunResult {
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '1', SKL_X_NO_UPDATE_CHECK: '1' };
  delete env.NO_COLOR;
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: cwd ?? process.cwd(),
    env,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// Fixtures live inside the skl-x git repo, so commands run in them would resolve to its root.
export function copyFixture(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `skl-fixture-${name.replaceAll('/', '-')}-`));
  cpSync(join(process.cwd(), 'test', 'fixtures', name), dir, { recursive: true, verbatimSymlinks: true });
  return dir;
}
