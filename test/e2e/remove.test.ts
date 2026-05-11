import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

let TMP = '';

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skl-rm-e2e-'));
  cpSync(LOCK_DIR, TMP, { recursive: true });
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('skl rm', () => {
  it('--yes removes from lock and deletes .claude/skills directory', () => {
    expect(existsSync(join(TMP, '.claude/skills/skill-foo/SKILL.md'))).toBe(true);
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "skill-foo" from skills-lock.json');
    expect(stdout).toMatch(/Removed "skill-foo" from \.claude\/skills/);
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    const { stdout: lsOut } = run(['ls'], TMP);
    expect(lsOut).toMatch(/skills-lock\.json\s+:\s+(?!.*\bskill-foo\b).*/);
  });

  it('--dry-run shows the plan without deleting', () => {
    const { stdout, exitCode } = run(['rm', '--dry-run', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Will remove "skill-foo"');
    expect(stdout).toContain('skills-lock.json');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo/SKILL.md'))).toBe(true);
  });

  it('reports skips when skill is missing from a source', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-baz'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "skill-baz" from skills-lock.json');
    expect(stdout).toContain('Skipped .claude/skills (not found)');
  });

  it('exits 1 when nothing matches', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'nonexistent'], TMP);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"nonexistent" is not in lock or on disk');
  });

  it('removes multiple skills with a single confirmation (--yes)', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-foo', 'skill-bar'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "skill-foo"');
    expect(stdout).toContain('Removed "skill-bar"');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    expect(existsSync(join(TMP, '.claude/skills/skill-bar'))).toBe(false);
  });

  it('rm alias works', () => {
    const { stdout, exitCode } = run(['remove', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "skill-foo"');
  });
});
