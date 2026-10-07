import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInstall, type SpawnOutcome, snapshotSkills } from './install';

let tmp = '';
let proj = '';

function seedSkill(root: string, name: string): void {
  mkdirSync(join(root, 'skills', name), { recursive: true });
  writeFileSync(join(root, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
}

// what `npx skills add … -a codex claude-code` leaves on disk for one skill
function fakeInstall(name: string): void {
  mkdirSync(join(proj, '.agents', 'skills', name), { recursive: true });
  writeFileSync(join(proj, '.agents', 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  mkdirSync(join(proj, '.claude', 'skills'), { recursive: true });
  symlinkSync(`../../.agents/skills/${name}`, join(proj, '.claude', 'skills', name));
  writeFileSync(
    join(proj, 'skills-lock.json'),
    JSON.stringify({ skills: { [name]: { source: 'x' } } }),
  );
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-install-unit-')));
  proj = join(tmp, 'proj');
  mkdirSync(proj);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const ok = (): SpawnOutcome => ({ status: 0, stdout: '', stderr: '' });

describe('runInstall - npx proxy', () => {
  it('passes args to npx skills add unchanged and in order, without capture', async () => {
    const spawn = vi.fn((_c: string, _a: string[], _capture: boolean) => ok());
    const status = await runInstall(
      ['sentimony/skills', '-s', 'cross-review', 'tdd', '-a', 'codex', 'claude-code', '-y'],
      { spawn, cwd: proj },
    );
    expect(status).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      'npx',
      [
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
      ],
      false,
    );
  });

  it('returns the npx exit code', async () => {
    const spawn = vi.fn(() => ({ status: 3 }));
    expect(await runInstall(['sentimony/skills'], { spawn, cwd: proj })).toBe(3);
  });

  it('returns 1 and reports the error when npx cannot start', async () => {
    const spawn = vi.fn(() => ({ status: null, error: new Error('spawn npx ENOENT') }));
    expect(await runInstall(['sentimony/skills'], { spawn, cwd: proj })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ENOENT'));
  });

  it('prints its own help for -h without spawning npx', async () => {
    const spawn = vi.fn(ok);
    expect(await runInstall(['-h'], { spawn, cwd: proj })).toBe(0);
    expect(await runInstall(['-ln', '--help'], { spawn, cwd: proj })).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('npx -y skills add'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('-ln, --link'));
  });

  it('rejects a bad --mode value without spawning npx', async () => {
    const spawn = vi.fn(ok);
    expect(await runInstall(['sentimony/skills', '-y', '-m', 'loud'], { spawn, cwd: proj })).toBe(
      1,
    );
    expect(console.error).toHaveBeenCalledWith('skl install: unknown mode "loud", use silent (s)');
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('runInstall - silent mode', () => {
  it('hides npx output, strips -m and prints a summary with a table', async () => {
    const spawn = vi.fn((_c: string, _a: string[], _capture: boolean) => {
      fakeInstall('webapp-debugger');
      return { status: 0, stdout: 'NOISE', stderr: '' };
    });
    const status = await runInstall(
      ['sentimony/skills', '-s', 'webapp-debugger', '-a', 'codex', 'claude-code', '-y', '-m', 's'],
      { spawn, cwd: proj },
    );
    expect(status).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      'npx',
      [
        '-y',
        'skills',
        'add',
        'sentimony/skills',
        '-s',
        'webapp-debugger',
        '-a',
        'codex',
        'claude-code',
        '-y',
      ],
      true,
    );
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing from sentimony/skills...',
      'Installed 1 skill from sentimony/skills',
      'skill            .agents    .claude    skills-lock.json',
      'webapp-debugger  universal  symlinked  +',
    ]);
  });

  it('needs -y and does not spawn npx without it', async () => {
    const spawn = vi.fn(ok);
    expect(await runInstall(['sentimony/skills', '--mode', 'silent'], { spawn, cwd: proj })).toBe(
      1,
    );
    expect(console.error).toHaveBeenCalledWith(
      'skl install: --mode silent needs -y/--yes (npx skills add asks questions otherwise)',
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it('prints the captured output and keeps the exit code when npx fails', async () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const spawn = vi.fn(() => ({ status: 2, stdout: 'out', stderr: 'err' }));
    expect(await runInstall(['sentimony/skills', '-y', '-m', 's'], { spawn, cwd: proj })).toBe(2);
    expect(out).toHaveBeenCalledWith('out');
    expect(err).toHaveBeenCalledWith('err');
  });

  it('reports 0 skills without a table when nothing changed', async () => {
    fakeInstall('tdd');
    const spawn = vi.fn(ok);
    expect(await runInstall(['sentimony/skills', '-y', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing from sentimony/skills...',
      'Installed 0 skills from sentimony/skills',
    ]);
  });

  it('counts a reinstalled skill and skips an untouched one', async () => {
    fakeInstall('tdd');
    // pin old mtimes so the reinstall is detected even if ext4 reuses the inode within one clock tick
    for (const p of [
      join(proj, '.agents', 'skills', 'tdd'),
      join(proj, '.agents', 'skills', 'tdd', 'SKILL.md'),
    ])
      utimesSync(p, new Date(0), new Date(0));
    seedSkill(join(proj, '.agents'), 'untouched');
    const spawn = vi.fn(() => {
      rmSync(join(proj, '.agents', 'skills', 'tdd'), { recursive: true });
      rmSync(join(proj, '.claude', 'skills', 'tdd'));
      fakeInstall('tdd');
      return ok();
    });
    expect(await runInstall(['sentimony/skills', '-y', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(console.log).toHaveBeenCalledWith('Installed 1 skill from sentimony/skills');
    expect(console.log).toHaveBeenCalledWith('tdd    universal  symlinked  +');
  });

  it('snapshots the global dirs under deps.home with -g', async () => {
    const home = join(tmp, 'home');
    const spawn = vi.fn(() => {
      mkdirSync(join(home, '.agents', 'skills', 'g1'), { recursive: true });
      writeFileSync(join(home, '.agents', 'skills', 'g1', 'SKILL.md'), '---\nname: g1\n---\n');
      writeFileSync(
        join(home, '.agents', '.skill-lock.json'),
        JSON.stringify({ skills: { g1: {} } }),
      );
      return ok();
    });
    expect(
      await runInstall(['sentimony/skills', '-g', '-y', '-m', 's'], { spawn, cwd: proj, home }),
    ).toBe(0);
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(lines).toContain('Installed 1 skill from sentimony/skills');
    expect(lines.some((l) => l.startsWith('skill') && l.includes('.agents/.skill-lock.json'))).toBe(
      true,
    );
    expect(lines.some((l) => l.startsWith('g1 ') && l.endsWith('+'))).toBe(true);
  });

  it('counts a skill whose only change is its lock entry', async () => {
    fakeInstall('tdd');
    const spawn = vi.fn(() => {
      writeFileSync(
        join(proj, 'skills-lock.json'),
        JSON.stringify({ skills: { tdd: { source: 'y' } } }),
      );
      return ok();
    });
    expect(await runInstall(['sentimony/skills', '-y', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(console.log).toHaveBeenCalledWith('Installed 1 skill from sentimony/skills');
  });

  it('drops "from <source>" when the first argument is a flag', async () => {
    const spawn = vi.fn(ok);
    expect(await runInstall(['-y', 'sentimony/skills', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing...',
      'Installed 0 skills',
    ]);
  });
});

describe('runInstall - link mode', () => {
  beforeEach(() => seedSkill(join(tmp, 'clone'), 'tdd'));

  it.each([
    [['-ln', '../clone', '-y']],
    [['../clone', '-y', '--link']],
    [['../clone', '-ln', '-y', '-m', 's']],
  ])('%j symlinks without spawning npx', async (argv) => {
    const spawn = vi.fn(ok);
    expect(await runInstall(argv, { spawn, cwd: proj })).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(existsSync(join(proj, '.agents', 'skills', 'tdd'))).toBe(true);
    expect(console.log).toHaveBeenCalledWith('Symlinked 1 skill from ../clone');
  });

  it('rejects npx-only options', async () => {
    expect(await runInstall(['-ln', '../clone', '-l'], { cwd: proj })).toBe(1);
    expect(console.error).toHaveBeenCalledWith('Unknown option: -l');
  });

  it('rejects a source that is not a local directory', async () => {
    expect(await runInstall(['-ln', 'sentimony/skills'], { cwd: proj })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      'skl install --link: sentimony/skills is not a local directory',
    );
  });
});

describe('snapshotSkills', () => {
  it('keys every name in both roots and the lock', () => {
    fakeInstall('a');
    seedSkill(join(proj, '.claude'), 'b');
    const snap = snapshotSkills(
      { agents: join(proj, '.agents', 'skills'), claude: join(proj, '.claude', 'skills') },
      join(proj, 'skills-lock.json'),
    );
    expect([...snap.keys()].sort()).toEqual(['a', 'b']);
  });
});
