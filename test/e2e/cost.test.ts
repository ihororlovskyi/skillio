import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const COST_DIR = join(process.cwd(), 'test', 'fixtures', 'cost');

describe('skl cost', () => {
  it('prints ~N tok for skills with frontmatter and missing for absent files', () => {
    const { stdout, exitCode } = run(['cost'], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/brainstorming\s+~\d+ tok/);
    expect(stdout).toMatch(/no-fm\s+\(no frontmatter\)/);
    expect(stdout).toMatch(/ghost-skill\s+missing/);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills \(1 missing\)/);
  });

  it('--json outputs structured rows', () => {
    const { stdout, exitCode } = run(['cost', '--json'], COST_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Array<{ skill: string; tokens: number | string }>;
    expect(parsed).toHaveLength(3);
    const ghost = parsed.find((r) => r.skill === 'ghost-skill');
    expect(ghost?.tokens).toBe('missing');
    const noFm = parsed.find((r) => r.skill === 'no-fm');
    expect(noFm?.tokens).toBe('no-frontmatter');
    const brain = parsed.find((r) => r.skill === 'brainstorming');
    expect(typeof brain?.tokens).toBe('number');
  });
});
