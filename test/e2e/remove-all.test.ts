import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = resolve(__dirname, '..', '..', 'dist', 'cli.js');

describe('skl rm .', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'skl-rm-all-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function seed3() {
    writeFileSync(
      join(tmp, 'skills-lock.json'),
      JSON.stringify({ skills: { foo: {}, bar: {}, baz: {} } }),
    );
    for (const name of ['foo', 'bar', 'baz']) {
      mkdirSync(join(tmp, '.claude', 'skills', name), { recursive: true });
      writeFileSync(join(tmp, '.claude', 'skills', name, 'SKILL.md'), '---\nname: x\n---\nbody');
    }
  }

  it('wipes all on-disk skills', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'skills', 'bar'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'skills', 'baz'))).toBe(false);
  });

  it('keeps lock by default (. without --force-lock)', () => {
    seed3();
    spawnSync(process.execPath, [CLI, 'rm', '.', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills).sort()).toEqual(['bar', 'baz', 'foo']);
  });

  it('. --force-lock wipes lock entries', () => {
    seed3();
    spawnSync(
      process.execPath,
      [CLI, 'rm', '.', '--force-lock', '--yes'],
      { cwd: tmp, encoding: 'utf8', env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' } },
    );
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(lock.skills).toEqual({});
  });

  it('. -fl (short alias for --force-lock) wipes lock entries', () => {
    seed3();
    spawnSync(
      process.execPath,
      [CLI, 'rm', '.', '-fl', '--yes'],
      { cwd: tmp, encoding: 'utf8', env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' } },
    );
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(lock.skills).toEqual({});
  });

  it('rejects positional names alongside .', () => {
    seed3();
    const r = spawnSync(
      process.execPath,
      [CLI, 'rm', '.', 'foo', '--yes'],
      { cwd: tmp, encoding: 'utf8', env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' } },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('mutually exclusive');
  });

  it('. on empty scope says "No skills to remove"', () => {
    writeFileSync(join(tmp, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No skills to remove');
  });
});
