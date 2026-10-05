import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

const COST_DIR = join(process.cwd(), 'test', 'fixtures', 'cost');

describe('bare skl', () => {
  it('non-TTY (piped stdout) falls back to cost', () => {
    const { stdout, exitCode } = run([], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Total: ~\d+ tok across/);
  });
});

const CLI = resolve(process.cwd(), 'dist', 'cli.js');

describe('picker - non-TTY fallback (remove sub-picker)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'skl-picker-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('non-TTY pipe - bare skl runs cost fallback (regression: 0.1.10)', () => {
    writeFileSync(join(tmp, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    const r = spawnSync(process.execPath, [CLI], { cwd: tmp, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Project Scope/);
  });

  it('quit option exits 0 (regression: 0.1.10)', () => {
    writeFileSync(join(tmp, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    const r = spawnSync(process.execPath, [CLI], { cwd: tmp, encoding: 'utf8', input: '' });
    expect(r.status).toBe(0);
  });
});
