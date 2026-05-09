import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

describe('skvisor list', () => {
  it('lists skills from skills-lock.json in cwd with total count', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('brainstorming');
    expect(stdout).toContain('writing-plans');
    expect(stdout).toContain('frontend-design');
    expect(stdout).toContain('Total: 3 skills');
  });

  it('ls alias works the same as list', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Total: 3 skills');
  });

  it('--json outputs a JSON array', () => {
    const { stdout, exitCode } = run(['ls', '--json'], LOCK_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as string[];
    expect(parsed).toContain('brainstorming');
    expect(parsed.length).toBe(3);
  });
});
