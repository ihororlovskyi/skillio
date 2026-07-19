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

  it('wipes all on-disk skills and lock entries with --yes', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('3 skills');
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'skills', 'bar'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'skills', 'baz'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(lock.skills).toEqual({});
  });

  it('y then n removes all disk dirs but keeps all lock entries', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.'], {
      cwd: tmp,
      encoding: 'utf8',
      input: 'y\nn\n',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills).sort()).toEqual(['bar', 'baz', 'foo']);
  });

  it('rejects positional names alongside .', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', 'foo', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
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

  it('-x keeps rejected skill, removes the rest from disk and lock', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '-x', 'foo', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('2 skills');
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmp, '.claude', 'skills', 'bar'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'skills', 'baz'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).toEqual(['foo']);
  });

  it('--reject accepts multiple space-separated names', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '--reject', 'foo', 'bar', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('1 skill');
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmp, '.claude', 'skills', 'bar', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmp, '.claude', 'skills', 'baz'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills).sort()).toEqual(['bar', 'foo']);
  });

  it('-x with positional skill names is rejected', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', 'foo', '-x', 'bar', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--reject');
  });

  it('-x without values is rejected', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '-x', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--reject');
  });

  it('-x with an unknown skill name is rejected', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '-x', 'nope', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('nope');
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
  });

  it('rejecting every skill leaves nothing to remove', () => {
    seed3();
    const r = spawnSync(
      process.execPath,
      [CLI, 'rm', '.', '-x', 'foo', 'bar', 'baz', '--yes'],
      {
        cwd: tmp,
        encoding: 'utf8',
        env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
      },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No skills to remove');
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
  });

  it('--lock-only wipes only lock entries, keeps disk dirs', () => {
    seed3();
    const r = spawnSync(process.execPath, [CLI, 'rm', '.', '--lock-only', '--yes'], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    const lock = JSON.parse(readFileSync(join(tmp, 'skills-lock.json'), 'utf8'));
    expect(lock.skills).toEqual({});
    expect(existsSync(join(tmp, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
  });
});
