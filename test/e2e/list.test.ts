import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './helpers';

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock');
const CLI = resolve(process.cwd(), 'dist', 'cli.js');

// Helper that forces ANSI color output for assertions on colored text
function runWithColor(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8' as const,
    env: { ...process.env, FORCE_COLOR: '1', SKILLIO_NO_UPDATE_CHECK: '1' },
  });
}

describe('skl ls', () => {
  it('renders compact per-source one-liner: label : N skills : names', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    // .claude has skill-bar and skill-foo (2 skills on disk)
    expect(stdout).toMatch(/\.claude\/skills\s+:\s+2 skills\s+:\s+skill-bar\s+skill-foo/);
    // lock row lists all lock entries; orphans (skill-baz) included
    expect(stdout).toMatch(
      /skills-lock\.json\s+:\s+3 skills\s+:\s+skill-bar\s+skill-baz\s+skill-foo/,
    );
    expect(stdout).not.toMatch(/~\d+ tok/);
  });

  it('does not emit a "missing on disk" diff line (orphans shown inline in lock row)', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain('missing on disk');
  });

  it('list alias works', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('skills-lock.json');
  });

  it('always shows .agents/skills row even when empty (0 skills)', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\.agents\/skills\s+:\s+0 skills?/);
  });

  it('all-onboard fixture lists lock names uncolored in lock row', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'all-onboard');
    const r = runWithColor(['list'], fix);
    expect(r.status).toBe(0);
    const plain = r.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toMatch(/skills-lock\.json\s*:\s*2 skills\s*:\s*bar\s+foo/);
    expect(plain).not.toContain('All skills onboard!');
    // lock row names carry no ANSI color
    const lockLine = r.stdout.split('\n').find((l) => l.includes('skills-lock.json')) ?? '';
    expect(lockLine).not.toMatch(/\x1b\[/);
  });

  it('missing-in-lock fixture renders orphan name red in lock row', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'missing-in-lock');
    const r = runWithColor(['list'], fix);
    expect(r.status).toBe(0);
    const plain = r.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toMatch(/skills-lock\.json\s*:\s*2 skills\s*:\s*foo\s+phantom/);
    expect(r.stdout).toMatch(/\x1b\[31m[^\x1b]*phantom/);
    // non-orphan lock name stays uncolored
    expect(r.stdout).not.toMatch(/\x1b\[31m[^\x1b]*foo/);
  });

  it('symlinked-skill fixture renders disk name yellow', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'symlinked-skill');
    const r = runWithColor(['list'], fix);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\.claude\/skills[^\n]*\x1b\[33m[^\x1b]*foo/);
  });

  it('reorder fixture renders .agents row before .claude', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'reorder');
    const r = runWithColor(['list'], fix);
    expect(r.status).toBe(0);
    const plain = r.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    const agentsIdx = plain.indexOf('.agents/skills');
    const claudeIdx = plain.indexOf('.claude/skills');
    expect(agentsIdx).toBeGreaterThanOrEqual(0);
    expect(claudeIdx).toBeGreaterThan(agentsIdx);
  });

  it('prints "Local" header as first line by default', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
    const r = run(['ls'], fix);
    expect(r.exitCode).toBe(0);
    const lines = r.stdout.split('\n');
    expect(lines[0]).toBe('Local');
  });

  it('prints "Global" header when -g is passed', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
    const home = mkdtempSync(join(tmpdir(), 'skl-ls-global-'));
    try {
      const r = spawnSync(process.execPath, [CLI, 'ls', '-g'], {
        encoding: 'utf8',
        cwd: fix,
        env: { ...process.env, HOME: home, SKILLIO_NO_UPDATE_CHECK: '1' },
      });
      expect(r.status).toBe(0);
      const lines = (r.stdout ?? '').split('\n');
      expect(lines[0]).toBe('Global');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('global scope shows real lock filename .agents/.skill-lock.json (not skills-lock.json)', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
    const home = mkdtempSync(join(tmpdir(), 'skl-ls-global-label-'));
    try {
      const r = spawnSync(process.execPath, [CLI, 'ls', '-g'], {
        encoding: 'utf8',
        cwd: fix,
        env: { ...process.env, HOME: home, SKILLIO_NO_UPDATE_CHECK: '1' },
      });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/\.agents\/\.skill-lock\.json\s*:/);
      // local label MUST NOT appear in global output
      expect(r.stdout).not.toMatch(/^skills-lock\.json\s*:/m);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not show "All skills onboard!" when lock has 0 entries', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
    const r = run(['ls'], fix);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain('All skills onboard!');
    // count cell still shows 0 skills
    expect(r.stdout).toMatch(/skills-lock\.json\s+:\s+0 skills\s*$/m);
  });

  it('--names prints one name per line, sorted, no header, no colors', () => {
    const r = runWithColor(['ls', '--names'], LOCK_DIR);
    expect(r.status).toBe(0);
    const lines = r.stdout.split('\n').filter((l) => l.length > 0);
    expect(lines).toEqual(['skill-bar', 'skill-baz', 'skill-foo']);
    // no ANSI sequences
    expect(r.stdout).not.toMatch(/\x1b\[/);
    // no Local/Global header
    expect(r.stdout).not.toMatch(/^(Local|Global)$/m);
  });

  it('--names emits nothing when scope is empty', () => {
    const fix = resolve(__dirname, '..', 'fixtures', 'list', 'empty-local');
    const r = run(['ls', '--names'], fix);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('');
  });
});
