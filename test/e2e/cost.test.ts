import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const COST_DIR = join(process.cwd(), 'test', 'fixtures', 'cost');

describe('skl cost', () => {
  it('lists per-skill cost sorted desc with verdict line', () => {
    const { stdout, exitCode } = run(['cost'], COST_DIR);
    expect(exitCode).toBe(0);
    // skill-foo has frontmatter, comes before missing/no-frontmatter rows
    const lines = stdout.split('\n').filter((l) => l.trim().length);
    const brainIdx = lines.findIndex((l) => l.startsWith('skill-foo'));
    const noFmIdx = lines.findIndex((l) => l.startsWith('no-fm'));
    const ghostIdx = lines.findIndex((l) => l.startsWith('ghost-skill'));
    expect(brainIdx).toBeLessThan(noFmIdx);
    expect(brainIdx).toBeLessThan(ghostIdx);
    expect(stdout).toMatch(/skill-foo\s+~\d+ tok/);
    expect(stdout).toMatch(/no-fm\s+\(no frontmatter\)/);
    expect(stdout).toMatch(/ghost-skill\s+~\? tok\s+missing/);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
    // small fixture → green verdict
    expect(stdout).toMatch(/OK — keep it lean/);
  });

  it('cs alias works', () => {
    const { stdout, exitCode } = run(['cs'], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
  });

  it('bare skl with no args runs cost', () => {
    const { stdout, exitCode } = run([], COST_DIR);
    expect(exitCode).toBe(0);
    // cost format — NOT the old summary "Total: N skills ~M tok" format
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
    // summary printed both Global + Local sections; cost only prints one header
    expect(stdout).not.toContain('Global');
  });

  it('prints blank line before Local header and before Total line', () => {
    const { stdout, exitCode } = run(['cost'], COST_DIR);
    expect(exitCode).toBe(0);
    const lines = stdout.split('\n');
    expect(lines[0]).toBe('');
    expect(lines[1]).toBe('Local');
    const totalIdx = lines.findIndex((l) => l.startsWith('Total:'));
    expect(totalIdx).toBeGreaterThan(0);
    expect(lines[totalIdx - 1]).toBe('');
  });

  it('cst alias works', () => {
    const { stdout, exitCode } = run(['cst'], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Total: ~\d+ tok across 3 skills/);
  });

  it('summary includes method label', () => {
    const { stdout, exitCode } = run(['cost'], COST_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('·  method: chars/4, yaml-frontmatter');
  });
});
