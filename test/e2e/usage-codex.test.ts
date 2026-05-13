import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'codex');

describe('skl usage codex', () => {
  it('counts activations from exec_command_end entries', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--agent',
      'codex',
      '--mode',
      'activations',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-foo');
    expect(stdout).toContain('skill-bar');
    expect(stdout).toMatch(/2\s+skill-foo/);
    expect(stdout).toContain('skill-baz');
    expect(stdout).toMatch(/1\s+skill-baz/);
  });

  it('outputs valid JSON', () => {
    const { stdout, exitCode } = run([
      'usage',
      '--agent',
      'codex',
      '--mode',
      'activations',
      '--root',
      FIXTURES,
      '--scan-all-files',
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { agent: string; skills: unknown[] };
    expect(parsed.agent).toBe('codex');
    expect(parsed.skills.length).toBeGreaterThan(0);
  });
});
