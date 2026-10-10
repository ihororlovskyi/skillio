import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homeEnv, makeHome, run, seedCodexSessions } from './helpers';

describe('skl usage codex', () => {
  let home = '';
  let project = '';
  beforeEach(() => {
    ({ home, project } = makeHome('skl-usg-codex-'));
    seedCodexSessions(home, project);
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));
  const usg = (args: string[]) => run(args, project, homeEnv(home));

  it('counts activations from exec_command_end entries', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'codex',
      '--mode',
      'activations',
      '--scan-all-files',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skill-foo');
    expect(stdout).toContain('skill-bar');
    expect(stdout).toMatch(/^skill-foo +2 +~/m);
    expect(stdout).toContain('skill-baz');
    expect(stdout).toMatch(/^skill-baz +1 +~/m);
  });

  it('outputs valid JSON', () => {
    const { stdout, exitCode } = usg([
      'usage',
      '--agent',
      'codex',
      '--mode',
      'activations',
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

describe('skl usage codex without session dirs', () => {
  let home: string;
  let project: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'skl-usg-home-'));
    project = join(home, 'project');
    mkdirSync(join(project, '.git'), { recursive: true });
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it.each([[['-a', 'codex']]])('reports no usage for %s', (args) => {
    const { stdout, stderr, exitCode } = run(
      ['usg', '-p', '2d', ...args],
      project,
      { HOME: home, NO_COLOR: '1' },
    );
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No skill usage by 2d');
  });
});
