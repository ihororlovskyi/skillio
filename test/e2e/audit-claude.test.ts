import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'claude');

describe('skvisor audit claude', () => {
  it('counts attributed skills from fixtures', () => {
    const { stdout, exitCode } = run([
      '--agent',
      'claude',
      '--mode',
      'attributed',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('brainstorming');
    expect(stdout).toContain('writing-plans');
    expect(stdout).toMatch(/2\s+brainstorming/);
    expect(stdout).toMatch(/1\s+writing-plans/);
  });

  it('counts activations mode', () => {
    const { stdout, exitCode } = run([
      '--agent',
      'claude',
      '--mode',
      'activations',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('simplify');
    expect(stdout).toContain('brainstorming');
  });

  it('outputs valid JSON with --format json', () => {
    const { stdout, exitCode } = run([
      '--agent',
      'claude',
      '--mode',
      'attributed',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      agent: string;
      skills: Array<{ skill: string; count: number }>;
    };
    expect(parsed.agent).toBe('claude');
    expect(parsed.skills[0]?.skill).toBe('brainstorming');
    expect(parsed.skills[0]?.count).toBe(2);
  });

  it('exits non-zero when --agent is missing', () => {
    const { exitCode } = run(['--root', FIXTURES]);
    expect(exitCode).not.toBe(0);
  });

  it('filters out old entries by default', () => {
    const { stdout, exitCode } = run([
      '--agent',
      'claude',
      '--mode',
      'attributed',
      '--root',
      FIXTURES,
      '--period',
      '7d',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain('old-skill');
  });
});
