import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run, runWithColor } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');
const EMPTY = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
const CLI = resolve(process.cwd(), 'dist', 'cli.js');

let tmp = '';
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = '';
});

// a: real in .agents + symlink in .claude + lock; b: real in .claude; c: dangling in .claude; d: lock only
function seedAllStates(): string {
  tmp = mkdtempSync(join(tmpdir(), 'skl-ls-states-'));
  writeFileSync(join(tmp, 'skills-lock.json'), JSON.stringify({ skills: { a: {}, d: {} } }));
  mkdirSync(join(tmp, '.agents', 'skills', 'a'), { recursive: true });
  writeFileSync(join(tmp, '.agents', 'skills', 'a', 'SKILL.md'), '---\nname: a\n---\n');
  mkdirSync(join(tmp, '.claude', 'skills', 'b'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'skills', 'b', 'SKILL.md'), '---\nname: b\n---\n');
  symlinkSync('../../.agents/skills/a', join(tmp, '.claude', 'skills', 'a'));
  symlinkSync('../../.agents/skills/gone', join(tmp, '.claude', 'skills', 'c'));
  return tmp;
}

describe('skl ls', () => {
  it('prints one table row per skill with a total row', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(
      [
        'Project Scope',
        'skill      .agents  .claude  skills-lock.json',
        'skill-bar  -        copied   +',
        'skill-baz  -        -        +',
        'skill-foo  -        copied   +',
        '3 skills   0        2        3',
        '',
      ].join('\n'),
    );
  });

  it('list alias works', () => {
    expect(run(['list'], LOCK_DIR).stdout).toContain('skill-bar  -        copied   +');
  });

  it('shows every install state and no "not in lock" lines', () => {
    const { stdout, exitCode } = run(['ls'], seedAllStates());
    expect(exitCode).toBe(0);
    expect(stdout).toBe(
      [
        'Project Scope',
        'skill     .agents    .claude    skills-lock.json',
        'a         universal  symlinked  +',
        'b         -          copied     -',
        'c         -          broken     -',
        'd         -          -          +',
        '4 skills  1          3          2',
        '',
      ].join('\n'),
    );
    expect(stdout).not.toContain('not in lock');
  });

  it('colors cells and the orphan lock mark with FORCE_COLOR', () => {
    const r = runWithColor(['ls'], seedAllStates());
    expect(r.exitCode).toBe(0);
    expect(r.stdout.split('\n')[0]).toBe('\x1b[1mProject Scope\x1b[22m');
    expect(r.stdout).toContain('\x1b[1mskill\x1b[22m');
    expect(r.stdout).toContain('\x1b[32muniversal\x1b[0m');
    expect(r.stdout).toContain('\x1b[33msymlinked\x1b[0m');
    expect(r.stdout).toContain('\x1b[32mcopied\x1b[0m');
    expect(r.stdout).toContain('\x1b[31mbroken\x1b[0m');
    const lines = r.stdout.split('\n');
    expect(lines.find((l) => l.startsWith('d '))).toMatch(/\x1b\[31m\+\x1b\[0m$/);
    expect(lines.find((l) => l.startsWith('a '))).toMatch(/ \+$/);
  });

  it('prints "No skills in scope." for an empty scope', () => {
    const r = run(['ls'], EMPTY);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('Project Scope\nNo skills in scope.\n');
  });

  it('global scope uses the .agents/.skill-lock.json column label', () => {
    tmp = mkdtempSync(join(tmpdir(), 'skl-ls-global-'));
    mkdirSync(join(tmp, '.agents'), { recursive: true });
    writeFileSync(join(tmp, '.agents', '.skill-lock.json'), JSON.stringify({ skills: { foo: {} } }));
    const r = spawnSync(process.execPath, [CLI, 'ls', '-g'], {
      encoding: 'utf8',
      cwd: EMPTY,
      env: { ...process.env, HOME: tmp, SKL_X_NO_UPDATE_CHECK: '1', NO_COLOR: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(
      [
        'Global Scope',
        'skill    .agents  .claude  .agents/.skill-lock.json',
        'foo      -        -        +',
        '1 skill  0        0        1',
        '',
      ].join('\n'),
    );
  });

  it('--names prints one name per line, sorted, no header, no colors', () => {
    const r = runWithColor(['ls', '--names'], LOCK_DIR);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('skill-bar\nskill-baz\nskill-foo\n');
  });

  it('--names emits nothing when scope is empty', () => {
    const r = run(['ls', '--names'], EMPTY);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('');
  });
});
