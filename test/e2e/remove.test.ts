import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_FIXTURE = join(process.cwd(), 'test', 'fixtures', 'lock', 'skills-lock.json');

let TMP = '';

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skvisor-e2e-'));
  cpSync(LOCK_FIXTURE, join(TMP, 'skills-lock.json'));
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('skvisor remove', () => {
  it('removes a skill and prints the updated list', () => {
    const { stdout, exitCode } = run(['remove', 'brainstorming'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "brainstorming"');
    const match = stdout.match(/\[[\s\S]*\]/);
    const skills = JSON.parse(match![0]!) as string[];
    expect(skills).not.toContain('brainstorming');
    expect(skills).toContain('writing-plans');
  });

  it('rm alias works', () => {
    const { stdout, exitCode } = run(['rm', 'frontend-design'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "frontend-design"');
  });

  it('reports when skill is not in lock', () => {
    const { stdout, exitCode } = run(['remove', 'nonexistent'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('not in');
  });

  it('removes multiple skills at once', () => {
    const { stdout, exitCode } = run(['remove', 'brainstorming', 'writing-plans'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed "brainstorming"');
    expect(stdout).toContain('Removed "writing-plans"');
    const match = stdout.match(/\[[\s\S]*\]/);
    const skills = JSON.parse(match![0]!) as string[];
    expect(skills).not.toContain('brainstorming');
    expect(skills).not.toContain('writing-plans');
    expect(skills).toContain('frontend-design');
  });

  it('--dry-run prints without modifying the file', () => {
    const { stdout, exitCode } = run(['remove', '--dry-run', 'brainstorming'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Would remove');
    const { stdout: listOut } = run(['list', '--json'], TMP);
    const parsed = JSON.parse(listOut) as { 'skills-lock.json': string[] };
    expect(parsed['skills-lock.json']).toContain('brainstorming');
  });
});
