import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

let TMP = '';
let ARGS_FILE = '';
let ENV: Record<string, string> = {};

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skl-install-e2e-'));
  const bin = join(TMP, 'bin');
  mkdirSync(bin);
  ARGS_FILE = join(TMP, 'npx-args.txt');
  writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$NPX_ARGS_FILE"\nexit 3\n');
  chmodSync(join(bin, 'npx'), 0o755);
  ENV = { PATH: `${bin}:${process.env.PATH ?? ''}`, NPX_ARGS_FILE: ARGS_FILE };
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

function npxArgs(): string[] {
  return readFileSync(ARGS_FILE, 'utf8').trimEnd().split('\n');
}

describe('skl install', () => {
  it('passes -s and -a with several values to npx skills add unchanged', () => {
    const { exitCode } = run(
      ['i', 'sentimony/skills', '-s', 'cross-review', 'tdd', '-a', 'codex', 'claude-code', '-y'],
      TMP,
      ENV,
    );
    expect(exitCode).toBe(3);
    expect(npxArgs()).toEqual([
      '-y',
      'skills',
      'add',
      'sentimony/skills',
      '-s',
      'cross-review',
      'tdd',
      '-a',
      'codex',
      'claude-code',
      '-y',
    ]);
  });

  it('install is an alias of i', () => {
    run(['install', 'sentimony/skills', '-l'], TMP, ENV);
    expect(npxArgs()).toEqual(['-y', 'skills', 'add', 'sentimony/skills', '-l']);
  });

  it('moves a root -g after the command', () => {
    run(['-g', 'i', 'sentimony/skills'], TMP, ENV);
    expect(npxArgs()).toEqual(['-y', 'skills', 'add', '-g', 'sentimony/skills']);
  });

  it('an option value equal to a raw command name does not dispatch it', () => {
    const a = run(['--root', 'i', 'usage'], TMP, ENV);
    const b = run(['usage', '--root', 'symlink'], TMP, ENV);
    expect(existsSync(ARGS_FILE)).toBe(false);
    for (const r of [a, b]) expect(r.stderr).not.toMatch(/skl (install|symlink)|Unknown option/);
  });

  it('-h prints its own help', () => {
    const { stdout, exitCode } = run(['i', '-h'], TMP, ENV);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('npx -y skills add');
  });
});
