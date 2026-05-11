import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

describe('skl ls', () => {
  it('renders compact per-source one-liner: label : N skills : names', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\.claude\/skills\s+:\s+2 skills\s+:\s+brainstorming\s+writing-plans/);
    expect(stdout).toMatch(
      /skills-lock\.json\s+:\s+3 skills\s+:\s+brainstorming.*frontend-design.*writing-plans/,
    );
    expect(stdout).not.toMatch(/~\d+ tok/);
  });

  it('emits a diff line for skills missing on disk', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json has 1 skill missing on disk: frontend-design');
  });

  it('list alias works', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json');
  });
});
