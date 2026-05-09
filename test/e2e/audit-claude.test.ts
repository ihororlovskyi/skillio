import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'claude');

describe('skvisor audit claude', () => {
  it('counts attributed skills from fixtures', () => {
    const { stdout, exitCode } = run([
      'audit',
      '--agent',
      'claude-code',
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
      'audit',
      '--agent',
      'claude-code',
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
      'audit',
      '--agent',
      'claude-code',
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
    expect(parsed.agent).toBe('claude-code');
    expect(parsed.skills[0]?.skill).toBe('brainstorming');
    expect(parsed.skills[0]?.count).toBe(2);
  });

  it('audits both agents and all-time when --agent is missing', () => {
    const { stdout, exitCode } = run(['audit', '--root', FIXTURES]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('claude-code skill usage all-time');
    expect(stdout).toContain('codex skill usage all-time');
  });

  it('accepts space-separated agents (-a claude-code codex)', () => {
    const { stdout, exitCode } = run([
      'audit',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude-code',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('claude-code skill usage');
    expect(stdout).toContain('codex skill usage');
  });

  it('accepts legacy "audit" keyword as no-op prefix', () => {
    const { stdout, exitCode } = run([
      'audit',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude-code',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('claude-code skill usage');
    expect(stdout).toMatch(/2\s+brainstorming/);
  });

  it('accepts repeated --agent flag (-a claude -a codex)', () => {
    const { stdout, exitCode } = run([
      'audit',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude',
      '-a',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('claude-code skill usage');
    expect(stdout).toContain('codex skill usage');
  });

  it('filters out old entries with --period 7d', () => {
    const { stdout, exitCode } = run([
      'audit',
      '--agent',
      'claude-code',
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
