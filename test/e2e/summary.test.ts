import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

let TMP_HOME = '';

beforeEach(() => {
  TMP_HOME = mkdtempSync(join(tmpdir(), 'skl-summary-home-'));
});

afterEach(() => rmSync(TMP_HOME, { recursive: true, force: true }));

describe('skl (bare summary)', () => {
  it('shows Global, Local, Total sections', () => {
    const { stdout, exitCode } = run([], LOCK_DIR, { HOME: TMP_HOME });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Global');
    expect(stdout).toContain('Local');
    expect(stdout).toMatch(/Total: \d+ skills\s+~\d+ tok/);
  });

  it('global section is empty when HOME has no skills', () => {
    const { stdout, exitCode } = run([], LOCK_DIR, { HOME: TMP_HOME });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/~\/\.claude\/skills\s+:\s+\(empty\)/);
    expect(stdout).toMatch(/~\/\.agents\/skills\s+:\s+\(empty\)/);
    expect(stdout).toMatch(/~\/skills-lock\.json\s+:\s+\(empty\)/);
  });

  it('local section reflects fixture skills', () => {
    const { stdout, exitCode } = run([], LOCK_DIR, { HOME: TMP_HOME });
    expect(exitCode).toBe(0);
    // lock fixture has 2 .claude/skills dirs and 3 lock entries
    expect(stdout).toMatch(/\.claude\/skills\s+:\s+2 skills/);
    expect(stdout).toMatch(/skills-lock\.json\s+:\s+3 skills/);
  });

  it('-g produces same output as bare', () => {
    const bare = run([], LOCK_DIR, { HOME: TMP_HOME });
    const global = run(['-g'], LOCK_DIR, { HOME: TMP_HOME });
    expect(global.exitCode).toBe(0);
    expect(global.stdout).toBe(bare.stdout);
  });
});
