import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(process.cwd(), 'dist', 'cli.js');
const EMPTY = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');

// A fresh cache with a newer version makes the notice print without a network call.
describe('update check', () => {
  let home = '';
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'skl-x-update-'));
    mkdirSync(join(home, '.cache', 'skl-x'), { recursive: true });
    writeFileSync(
      join(home, '.cache', 'skl-x', 'version.json'),
      JSON.stringify({ checkedAt: Date.now(), latest: '99.0.0' }),
    );
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  function stderrWith(extra: Record<string, string>): string {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, ...extra };
    delete env.SKL_X_NO_UPDATE_CHECK;
    delete env.SKLX_NO_UPDATE_CHECK;
    Object.assign(env, extra);
    return spawnSync(process.execPath, [CLI, 'ls'], { encoding: 'utf8', cwd: EMPTY, env }).stderr;
  }

  it('reads the cache from ~/.cache/skl-x and prints the notice', () => {
    expect(stderrWith({})).toContain('Run: npm i -g skl-x');
  });

  it('is disabled by SKL_X_NO_UPDATE_CHECK', () => {
    expect(stderrWith({ SKL_X_NO_UPDATE_CHECK: '1' })).not.toContain('Update available');
  });

  it('is still disabled by the old SKLX_NO_UPDATE_CHECK', () => {
    expect(stderrWith({ SKLX_NO_UPDATE_CHECK: '1' })).not.toContain('Update available');
  });
});
