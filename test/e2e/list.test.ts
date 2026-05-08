import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

describe('skvisor list', () => {
  it('lists skills from skills-lock.json in cwd', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as string[];
    expect(parsed).toContain('brainstorming');
    expect(parsed).toContain('writing-plans');
    expect(parsed).toContain('frontend-design');
  });

  it('ls alias works the same as list', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as string[];
    expect(parsed.length).toBe(3);
  });
});
