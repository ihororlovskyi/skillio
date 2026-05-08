import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'codex');

describe('skvisor audit codex', () => {
  it('counts activations from exec_command_end entries', () => {
    const { stdout, exitCode } = run([
      '--agent',
      'codex',
      '--mode',
      'activations',
      '--root',
      FIXTURES,
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('brainstorming');
    expect(stdout).toContain('writing-plans');
    expect(stdout).toMatch(/2\s+brainstorming/);
  });

  it('outputs valid JSON', () => {
    const { stdout, exitCode } = run([
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
