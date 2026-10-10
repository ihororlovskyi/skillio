import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeEnv, makeHome, run, seedClaudeSessions } from './helpers';

describe('skl usage claude', () => {
  let home = '';
  let project = '';
  beforeEach(() => {
    ({ home, project } = makeHome('skl-usg-claude-'));
    seedClaudeSessions(home, project);
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));
  const usg = (args: string[]) => run(args, project, homeEnv(home));

  it('counts attributed skills from fixtures', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-foo');
    expect(stdout).toContain('skill-bar');
    expect(stdout).toMatch(/^skill-foo +2 +~/m);
    expect(stdout).toMatch(/^skill-bar +1 +~/m);
  });

  it('counts activations mode', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'activations',
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-quux');
    expect(stdout).toContain('skill-foo');
  });

  it('outputs valid JSON with --format json', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
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
    const { stdout, exitCode } = usg(['usage']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^Project scope · Usage \d+ times? by all$/m);
    expect(stdout).toMatch(/^skill +\.agents +\.claude +cost +total$/m);
  });

  it('accepts space-separated agents (-a claude-code codex)', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--scan-all-files',
      '-a',
      'claude-code',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^skill +\.agents +\.claude +cost +total$/m);
  });

  it('accepts legacy "audit" keyword as no-op prefix', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--scan-all-files',
      '-a',
      'claude-code',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^skill +\.claude +cost +total$/m);
    expect(stdout).toMatch(/^skill-foo +2 +~/m);
  });

  it('accepts repeated --agent flag (-a claude -a codex)', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--scan-all-files',
      '-a',
      'claude',
      '-a',
      'codex',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^skill +\.agents +\.claude +cost +total$/m);
  });

  it('usg alias works', () => {
    const { stdout, exitCode } = usg(['usg', '-a', 'claude-code', '--scan-all-files']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^skill +\.claude +cost +total$/m);
  });

  it('does not render skills with count=0', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toMatch(/^\S+ +0 +~/m);
  });

  it('prints no blank lines: header first, totals last', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    const lines = stdout.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^Project scope · Usage \d+ times? by all$/);
    expect(lines).not.toContain('');
    expect(lines.at(-1)).toMatch(/^\d+ skills? /);
  });

  it('prints the header and a no-usage line when nothing ran in the period', () => {
    const { stdout, exitCode } = usg(['usage', '--since', '2999-01-01']);
    expect(exitCode).toBe(0);
    expect(stdout.trimEnd().split('\n')).toEqual([
      expect.stringMatching(/^Project scope · Usage 0 times by since 2999-01-01$/),
      'No skill usage by since 2999-01-01',
    ]);
  });

  it('rejects an unknown --mode with exit 1 and no stdout', () => {
    const { stdout, stderr, exitCode } = usg(['usage', '--mode', 'merge']);
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(
      'Unknown mode: "merge". Use "merged", "attributed", "activations" or "mentions".',
    );
  });

  it('rejects an unknown --format with exit 1 and no stdout', () => {
    const { stdout, stderr, exitCode } = usg(['usage', '--format', 'yaml']);
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('Unknown format: "yaml". Use "text" or "json".');
  });

  it('filters out old entries with --period 7d', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'claude-code',
      '--mode',
      'attributed',
      '--period',
      '7d',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain('old-skill');
  });
});

describe('skl usage claude without session dirs', () => {
  let home: string;
  let project: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'skl-usg-home-'));
    project = join(home, 'project');
    mkdirSync(join(project, '.git'), { recursive: true });
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it.each([[['-a', 'claude-code']], [['-a', 'claude-code', '-g']], [[]], [['-g']]])('reports no usage for %s', (args) => {
    const { stdout, stderr, exitCode } = run(
      ['usg', '-p', '2d', ...args],
      project,
      { HOME: home, NO_COLOR: '1' },
    );
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No skill usage by 2d');
  });

  it('fails for a missing --root', () => {
    const root = join(home, 'missing');
    const { stderr, exitCode } = run(['usg', '--root', root, '-a', 'claude-code'], project, {
      HOME: home,
      NO_COLOR: '1',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`--root ${root} does not exist`);
  });
});
