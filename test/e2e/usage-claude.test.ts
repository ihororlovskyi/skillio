import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'claude');

describe('skl usage claude', () => {
  it('counts attributed skills from fixtures', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-foo');
    expect(stdout).toContain('skill-bar');
    expect(stdout).toMatch(/2\s+skill-foo/);
    expect(stdout).toMatch(/1\s+skill-bar/);
  });

  it('counts activations mode', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'activations',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-quux');
    expect(stdout).toContain('skill-foo');
  });

  it('outputs valid JSON with --format json', () => {
    const { stdout, exitCode } = run([
      'usage',
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
    expect(parsed.skills[0]?.skill).toBe('skill-foo');
    expect(parsed.skills[0]?.count).toBe(2);
  });

  it('audits both agents and all-time when --agent is missing', () => {
    const { stdout, exitCode } = run(['usage', '--root', FIXTURES]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/claude-code \d+ skills? \d+ times? by all/);
    expect(stdout).toMatch(/codex \d+ skills? \d+ times? by all/);
  });

  it('accepts space-separated agents (-a claude-code codex)', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude-code',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/claude-code \d+ skills?/);
    expect(stdout).toMatch(/codex \d+ skills?/);
  });

  it('accepts legacy "audit" keyword as no-op prefix', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude-code',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/claude-code \d+ skills?/);
    expect(stdout).toMatch(/2\s+skill-foo/);
  });

  it('accepts repeated --agent flag (-a claude -a codex)', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '-a',
      'claude',
      '-a',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/claude-code \d+ skills?/);
    expect(stdout).toMatch(/codex \d+ skills?/);
  });

  it('filters out old entries with --period 7d', () => {
    const { stdout, exitCode } = run([
      'usage',
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
