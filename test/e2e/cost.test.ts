import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const COST_DIR = join(process.cwd(), 'test', 'fixtures', 'cost');

describe('skl cost', () => {
  it('lists per-skill cost sorted desc with verdict line', () => {
    const { stdout, exitCode } = run(['cost'], COST_DIR);
    expect(exitCode).toBe(0);
    // brainstorming has frontmatter, comes before missing/no-frontmatter rows
    const lines = stdout.split('\n').filter((l) => l.trim().length);
    const brainIdx = lines.findIndex((l) => l.startsWith('brainstorming'));
    const noFmIdx = lines.findIndex((l) => l.startsWith('no-fm'));
    const ghostIdx = lines.findIndex((l) => l.startsWith('ghost-skill'));
    expect(brainIdx).toBeLessThan(noFmIdx);
    expect(brainIdx).toBeLessThan(ghostIdx);
    expect(stdout).toMatch(/brainstorming\s+~\d+ tok/);
    expect(stdout).toMatch(/no-fm\s+\(no frontmatter\)/);
    expect(stdout).toMatch(/ghost-skill\s+missing/);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
    // small fixture → green verdict
    expect(stdout).toMatch(/OK — keep it lean/);
  });

  it('bare `skl` with no args runs cost', () => {
    const { stdout, exitCode } = run([], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
  });

  it('co alias works', () => {
    const { stdout, exitCode } = run(['co'], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
  });

  it('--json outputs structured rows + total + verdict', () => {
    const { stdout, exitCode } = run(['cost', '--json'], COST_DIR);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      skills: Array<{ name: string; tokens?: number; status: string }>;
      total: number;
      verdict: 'ok' | 'plan' | 'cleanup';
    };
    expect(parsed.skills.length).toBe(3);
    expect(parsed.verdict).toBe('ok');
    expect(typeof parsed.total).toBe('number');
  });
});
