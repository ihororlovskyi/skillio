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
    expect(existsSync(join(TMP, '.claude/skills/brainstorming/SKILL.md'))).toBe(true);
    const { stdout, exitCode } = run(['rm', '--yes', 'brainstorming'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "brainstorming" from skills-lock.json');
    expect(stdout).toMatch(/Removed "brainstorming" from \.claude\/skills/);
    expect(existsSync(join(TMP, '.claude/skills/brainstorming'))).toBe(false);
    const { stdout: lsOut } = run(['ls'], TMP);
    expect(lsOut).toMatch(/skills-lock\.json\s+:\s+(?!.*\bbrainstorming\b).*/);
  });

  it('--dry-run shows the plan without deleting', () => {
    const { stdout, exitCode } = run(['rm', '--dry-run', 'brainstorming'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Will remove "brainstorming"');
    expect(stdout).toContain('skills-lock.json');
    expect(existsSync(join(TMP, '.claude/skills/brainstorming/SKILL.md'))).toBe(true);
  });

  it('reports skips when skill is missing from a source', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'frontend-design'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "frontend-design" from skills-lock.json');
    expect(stdout).toContain('Skipped .claude/skills (not found)');
  });

  it('exits 1 when nothing matches', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'nonexistent'], TMP);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"nonexistent" is not in lock or on disk');
  });

  it('removes multiple skills with a single confirmation (--yes)', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'brainstorming', 'writing-plans'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "brainstorming"');
    expect(stdout).toContain('Removed "writing-plans"');
    expect(existsSync(join(TMP, '.claude/skills/brainstorming'))).toBe(false);
    expect(existsSync(join(TMP, '.claude/skills/writing-plans'))).toBe(false);
  });

  it('rm alias works', () => {
    const { stdout, exitCode } = run(['remove', '--yes', 'brainstorming'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "brainstorming"');
  });
});
