import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeClaudeProjectDir } from '../../src/utils/scope';

const CLI = join(process.cwd(), 'dist', 'cli.js');
const FIXTURES = join(process.cwd(), 'test', 'fixtures');

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
  cpSync(join(FIXTURES, name), dir, { recursive: true, verbatimSymlinks: true });
  return dir;
}

// realpath: on macOS tmpdir() is /var/..., while the child's process.cwd() is /private/var/...
export function makeHome(prefix: string): { home: string; project: string } {
  const home = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  const project = join(home, 'project');
  mkdirSync(join(project, '.git'), { recursive: true });
  return { home, project };
}

export function seedClaudeSessions(home: string, project: string, fixture = 'claude'): void {
  const dir = join(home, '.claude', 'projects', encodeClaudeProjectDir(project));
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(FIXTURES, fixture, 'sample.jsonl'), join(dir, 'sample.jsonl'));
}

// The fixture has no session_meta, so project filtering would drop it without one.
export function seedCodexSessions(home: string, cwd: string, id = 'session-1'): void {
  const dir = join(home, '.codex', 'sessions');
  mkdirSync(dir, { recursive: true });
  const meta = JSON.stringify({ type: 'session_meta', payload: { id, session_id: id, cwd } });
  const body = readFileSync(join(FIXTURES, 'codex', 'sample.jsonl'), 'utf8');
  writeFileSync(join(dir, `${id}.jsonl`), `${meta}\n${body}`);
}

export function homeEnv(home: string): Record<string, string> {
  return { HOME: home, NO_COLOR: '1' };
}
