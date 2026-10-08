import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const EMPTY = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');

describe('sklx identity', () => {
  it.each([[['-v']], [['-h']], [['ls']]])('prints no deprecation line for %j', (args) => {
    const { stderr } = run(args, EMPTY);
    expect(stderr).not.toMatch(/deprecated|skillio/);
  });

  it('names sklx in root help', () => {
    const { stdout } = run(['-h'], EMPTY);
    expect(stdout).toContain('(sklx v');
    expect(stdout).toContain('USAGE sklx [OPTIONS] [COMMAND]');
    expect(stdout).not.toContain('skillio');
  });

  it('names sklx in rm and install help', () => {
    const rm = run(['rm', '-h'], EMPTY).stdout;
    expect(rm).toContain('USAGE sklx remove');
    expect(rm).not.toContain('skillio');
    const install = run(['i', '-h'], EMPTY).stdout;
    expect(install).toContain('USAGE sklx install');
    expect(install).not.toContain('skillio');
  });
});
