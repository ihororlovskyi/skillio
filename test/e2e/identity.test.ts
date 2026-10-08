import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const EMPTY = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');

describe('skl-x identity', () => {
  it.each([[['-v']], [['-h']], [['ls']]])('prints no deprecation line for %j', (args) => {
    const { stderr } = run(args, EMPTY);
    expect(stderr).not.toMatch(/deprecated|skillio/);
  });

  it('names skl-x in root help', () => {
    const { stdout } = run(['-h'], EMPTY);
    expect(stdout).toContain('(skl-x v');
    expect(stdout).toContain('USAGE skl-x [OPTIONS] [COMMAND]');
    expect(stdout).not.toMatch(/skillio|sklx/);
  });

  it('names skl-x in rm and install help', () => {
    const rm = run(['rm', '-h'], EMPTY).stdout;
    expect(rm).toContain('USAGE skl-x remove');
    expect(rm).not.toMatch(/skillio|sklx/);
    const install = run(['i', '-h'], EMPTY).stdout;
    expect(install).toContain('USAGE skl-x install');
    expect(install).not.toMatch(/skillio|sklx/);
  });
});

describe('skl-x package', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8')) as {
    name: string;
    bin: Record<string, string>;
  };

  it('is published as skl-x', () => {
    expect(pkg.name).toBe('skl-x');
  });

  // npx runs the bin named after the package when there are several
  it('has a bin named after the package for npx', () => {
    expect(pkg.bin).toEqual({ 'skl-x': 'dist/cli.js', skl: 'dist/cli.js' });
  });
});
