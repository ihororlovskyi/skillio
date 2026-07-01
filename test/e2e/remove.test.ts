import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

const CLI = resolve(__dirname, '..', '..', 'dist', 'cli.js');

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');

let TMP = '';

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skl-rm-e2e-'));
  cpSync(LOCK_DIR, TMP, { recursive: true });
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('skl rm', () => {
  it('--yes removes disk skills and the lock entry', () => {
    expect(existsSync(join(TMP, '.claude/skills/skill-foo/SKILL.md'))).toBe(true);
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"skill-foo"');
    expect(stdout).toContain('will be removed from:');
    expect(stdout).toContain('removed from:');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).not.toContain('skill-foo');
  });

  it('reports "not found" when a location is missing', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-baz'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"skill-baz"');
    expect(stdout).toContain('.agents/skills/skill-baz/  (not found)');
    expect(stdout).toContain('.claude/skills/skill-baz/  (not found)');
  });

  it('exits 1 when nothing matches', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'nonexistent'], TMP);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"nonexistent" is not in lock or on disk');
  });

  it('removes multiple skills with a single pair of confirmations (--yes)', () => {
    const { stdout, exitCode } = run(['rm', '--yes', 'skill-foo', 'skill-bar'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('2 skills');
    expect(stdout).toContain('"skill-foo"');
    expect(stdout).toContain('"skill-bar"');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    expect(existsSync(join(TMP, '.claude/skills/skill-bar'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).not.toContain('skill-foo');
    expect(Object.keys(lock.skills)).not.toContain('skill-bar');
  });

  it('rm alias works', () => {
    const { stdout, exitCode } = run(['remove', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"skill-foo"');
  });

  it('without --yes, declining Proceed? aborts and changes nothing', () => {
    const r = spawnSync(process.execPath, [CLI, 'rm', 'skill-foo'], {
      cwd: TMP,
      encoding: 'utf8',
      input: 'n\n',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('Aborted');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).toContain('skill-foo');
  });

  it('without --yes, y then n removes disk dirs but keeps the lock entry', () => {
    const r = spawnSync(process.execPath, [CLI, 'rm', 'skill-foo'], {
      cwd: TMP,
      encoding: 'utf8',
      input: 'y\nn\n',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    expect(r.stdout).toContain('kept)');
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).toContain('skill-foo');
  });

  it('without --yes, y then y removes both disk dirs and the lock entry', () => {
    const r = spawnSync(process.execPath, [CLI, 'rm', 'skill-foo'], {
      cwd: TMP,
      encoding: 'utf8',
      input: 'y\ny\n',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).not.toContain('skill-foo');
  });

  it('skips the lock question entirely when the skill is not in lock', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'skl-rm-nolock-'));
    writeFileSync(join(tmpDir, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    mkdirSync(join(tmpDir, '.claude', 'skills', 'foo'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'skills', 'foo', 'SKILL.md'), 'x');

    const r = spawnSync(process.execPath, [CLI, 'rm', 'foo'], {
      cwd: tmpDir,
      encoding: 'utf8',
      input: 'y\n',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('(not in lock)');
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'foo'))).toBe(false);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--lock-only removes only the lock entry, keeps disk dirs', () => {
    const { stdout, exitCode } = run(['rm', '--lock-only', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json');
    expect(stdout).not.toContain('.agents/skills');
    expect(stdout).not.toContain('.claude/skills');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).not.toContain('skill-foo');
  });

  it('--lo is an alias for --lock-only', () => {
    const { exitCode } = run(['rm', '--lo', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).not.toContain('skill-foo');
  });

  it('--claude-only removes only .claude/skills, keeps lock and .agents/skills', () => {
    const { stdout, exitCode } = run(['rm', '--claude-only', '--yes', 'skill-foo'], TMP);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('.claude/skills');
    expect(stdout).not.toContain('.agents/skills');
    expect(stdout).not.toContain('skills-lock.json');
    expect(existsSync(join(TMP, '.claude/skills/skill-foo'))).toBe(false);
    const lock = JSON.parse(readFileSync(join(TMP, 'skills-lock.json'), 'utf8'));
    expect(Object.keys(lock.skills)).toContain('skill-foo');
  });

  it('--agents-only removes only .agents/skills, keeps lock and .claude/skills', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'skl-rm-agents-only-'));
    writeFileSync(join(tmpDir, 'skills-lock.json'), JSON.stringify({ skills: { foo: {} } }));
    mkdirSync(join(tmpDir, '.agents', 'skills', 'foo'), { recursive: true });
    writeFileSync(join(tmpDir, '.agents', 'skills', 'foo', 'SKILL.md'), 'x');
    mkdirSync(join(tmpDir, '.claude', 'skills', 'foo'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'skills', 'foo', 'SKILL.md'), 'x');

    const r = spawnSync(process.execPath, [CLI, 'rm', 'foo', '--agents-only', '--yes'], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('.agents/skills');
    expect(r.stdout).not.toContain('.claude/skills');
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'foo'))).toBe(false);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'foo'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(tmpDir, 'skills-lock.json'), 'utf8'));
    expect(lock.skills).toHaveProperty('foo');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('two -only flags together are rejected', () => {
    const { stderr, exitCode } = run(
      ['rm', 'skill-foo', '--agents-only', '--claude-only', '--yes'],
      TMP,
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('mutually exclusive');
  });

  it('colors the real-install line green and the symlink line yellow (FORCE_COLOR)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'skl-rm-colors-'));
    writeFileSync(join(tmpDir, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    mkdirSync(join(tmpDir, '.agents', 'skills', 'foo'), { recursive: true });
    writeFileSync(join(tmpDir, '.agents', 'skills', 'foo', 'SKILL.md'), 'x');
    mkdirSync(join(tmpDir, '.claude', 'skills'), { recursive: true });
    symlinkSync(
      join(tmpDir, '.agents', 'skills', 'foo'),
      join(tmpDir, '.claude', 'skills', 'foo'),
      'dir',
    );

    const r = spawnSync(process.execPath, [CLI, 'rm', 'foo', '--yes'], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1', FORCE_COLOR: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('\x1b[32m');
    expect(r.stdout).toContain('\x1b[33m');
    expect(r.stdout).toContain('0 folders, 1 file');
    expect(r.stdout).toContain('1 symlink');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('aggregates mixed real and symlink installs across multiple targets in one line', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'skl-rm-mixed-'));
    writeFileSync(join(tmpDir, 'skills-lock.json'), JSON.stringify({ skills: {} }));
    mkdirSync(join(tmpDir, '.claude', 'skills', 'real-one'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'skills', 'real-one', 'SKILL.md'), 'x');
    mkdirSync(join(tmpDir, '.agents', 'skills', 'symlinked-one'), { recursive: true });
    writeFileSync(join(tmpDir, '.agents', 'skills', 'symlinked-one', 'SKILL.md'), 'x');
    symlinkSync(
      join(tmpDir, '.agents', 'skills', 'symlinked-one'),
      join(tmpDir, '.claude', 'skills', 'symlinked-one'),
      'dir',
    );

    const r = spawnSync(process.execPath, [CLI, 'rm', 'real-one', 'symlinked-one', '--yes'], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: { ...process.env, SKILLIO_NO_UPDATE_CHECK: '1' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('.claude/skills  (0 folders, 1 file, 1 symlink)');

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
