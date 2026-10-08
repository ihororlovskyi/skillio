import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const NOTICE =
  '@sentimony/sklx is deprecated, renamed to skl-x: npm rm -g @sentimony/sklx && npm i -g skl-x\n';
const EMPTY = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
const { version } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  version: string;
};

describe('rename notice', () => {
  it.each([[['-v']], [['-h']], [['ls']]])('prints the notice to stderr for %j', (args) => {
    const { stderr } = run(args, EMPTY);
    expect(stderr).toContain(NOTICE);
  });

  it('keeps -v stdout as the bare version', () => {
    const { stdout, exitCode } = run(['-v'], EMPTY);
    expect(stdout).toBe(`${version}\n`);
    expect(exitCode).toBe(0);
  });
});
