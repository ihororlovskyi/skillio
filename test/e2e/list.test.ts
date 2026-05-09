import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

describe('skl ls', () => {
  it('renders compact one-liner per source', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\.claude\/skills\s+:\s+brainstorming\s+writing-plans/);
    expect(stdout).toMatch(/skills-lock\.json\s+:\s+brainstorming.*frontend-design.*writing-plans/);
    expect(stdout).toMatch(/2 skills, ~\d+ tok/); // .claude/skills row
    expect(stdout).toMatch(/3 skills,/); // lock row count
  });

  it('emits a diff line for skills missing on disk', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json has 1 skill missing on disk: frontend-design');
  });

  it('--json shape', () => {
    const { stdout, exitCode } = run(['ls', '--json'], LOCK_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      '.claude/skills': string[];
      '.agents/skills'?: string[];
      'skills-lock.json': string[];
      diffs: { lockOnly: string[]; claudeNotInLock: string[]; agentsNotInLock: string[] };
    };
    expect(parsed['.claude/skills']).toEqual(['brainstorming', 'writing-plans']);
    expect(parsed['skills-lock.json']).toEqual([
      'brainstorming',
      'frontend-design',
      'writing-plans',
    ]);
    expect(parsed.diffs.lockOnly).toEqual(['frontend-design']);
  });

  it('list alias works', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json');
  });
});
