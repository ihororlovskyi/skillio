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
import {
  defaultSpawn,
  requestedSkills,
  runInstall,
  type SpawnOutcome,
  snapshotSkills,
  sourceLabel,
} from './install';

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
      fakeInstall('cross-review');
      return { status: 0, stdout: 'NOISE', stderr: '' };
    });
    const status = await runInstall(
      ['sentimony/skills', '-s', 'cross-review', '-a', 'codex', 'claude-code', '-y', '-m', 's'],
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
        '-a',
        'codex',
        'claude-code',
        '-y',
      ],
      true,
    );
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill',
      'skill         .agents    .claude    skills-lock.json  cost',
      'cross-review  universal  symlinked  +                 ~4 tok',
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
    expect(console.log).toHaveBeenCalledWith('Installing from https://github.com/sentimony/skills');
  });

  it('reports 0 skills without a table when nothing changed', async () => {
    fakeInstall('tdd');
    const spawn = vi.fn(ok);
    expect(await runInstall(['sentimony/skills', '-y', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 0 skills',
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
    expect(console.log).toHaveBeenCalledWith(
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill',
    );
    expect(console.log).toHaveBeenCalledWith(
      'tdd    universal  symlinked  +                 ~1 tok',
    );
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
    expect(lines).toContain(
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill',
    );
    expect(lines.some((l) => l.startsWith('skill') && l.includes('.agents/.skill-lock.json'))).toBe(
      true,
    );
    expect(lines.some((l) => /^g1 +universal +- +\+ +~1 tok$/.test(l))).toBe(true);
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
    expect(console.log).toHaveBeenCalledWith(
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill',
    );
  });

  it('drops "from <source>" when the first argument is a flag', async () => {
    const spawn = vi.fn(ok);
    expect(await runInstall(['-y', 'sentimony/skills', '-m', 's'], { spawn, cwd: proj })).toBe(0);
    expect(vi.mocked(console.log).mock.calls.map((c) => c[0])).toEqual([
      'Installing ██████████ 100% · Installed 0 skills',
    ]);
  });
  it('awaits an async spawner', async () => {
    const spawn = vi.fn(async () => {
      fakeInstall('tdd');
      return ok();
    });
    expect(
      await runInstall(['sentimony/skills', '-s', 'tdd', '-y', '-m', 's'], { spawn, cwd: proj }),
    ).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      'Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill',
    );
  });

  it('polls the disk every 100 ms, stays below 100% until npx exits and stops polling after', async () => {
    vi.useFakeTimers();
    const tty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const frames: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      frames.push(String(s));
      return true;
    });
    try {
      let finish: (r: SpawnOutcome) => void = () => {};
      const spawn = vi.fn(
        () =>
          new Promise<SpawnOutcome>((done) => {
            finish = done;
          }),
      );
      const run = runInstall(['sentimony/skills', '-s', 'a', 'b', '-y', '-m', 's'], {
        spawn,
        cwd: proj,
      });
      expect(frames.at(-1)).toBe(
        '\r\x1b[2KInstalling from https://github.com/sentimony/skills ░░░░░░░░░░ 0%',
      );
      fakeInstall('a');
      fakeInstall('b');
      await vi.advanceTimersByTimeAsync(100);
      expect(frames.at(-1)).toBe(
        '\r\x1b[2KInstalling from https://github.com/sentimony/skills █████████░ 99%',
      );
      finish(ok());
      expect(await run).toBe(0);
      const count = frames.length;
      await vi.advanceTimersByTimeAsync(500);
      expect(frames.length).toBe(count);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (tty) Object.defineProperty(process.stdout, 'isTTY', tty);
      else delete (process.stdout as { isTTY?: boolean }).isTTY;
      vi.useRealTimers();
    }
  });
});

describe('sourceLabel', () => {
  it('expands the owner/repo shorthand to a GitHub URL', () => {
    expect(sourceLabel('sentimony/skills')).toBe('https://github.com/sentimony/skills');
  });

  it('keeps URLs, paths and flags as given', () => {
    expect(sourceLabel('https://github.com/sentimony/skills')).toBe(
      'https://github.com/sentimony/skills',
    );
    expect(sourceLabel('../skills')).toBe('../skills');
    expect(sourceLabel('./skills')).toBe('./skills');
    expect(sourceLabel('~/skills')).toBe('~/skills');
    expect(sourceLabel('sentimony/skills/tree/main/skills/tdd')).toBe(
      'sentimony/skills/tree/main/skills/tdd',
    );
    expect(sourceLabel('-y')).toBe('');
    expect(sourceLabel(undefined)).toBe('');
  });
});

describe('requestedSkills', () => {
  it('collects names after -s/--skill up to the next flag', () => {
    expect(
      requestedSkills(['x/y', '-s', 'tdd', 'cross-review', '-a', 'codex', '--skill', 'tdd']),
    ).toEqual(['tdd', 'cross-review']);
  });

  it('has no total without -s or with *', () => {
    expect(requestedSkills(['x/y', '-y'])).toBeNull();
    expect(requestedSkills(['x/y', '-s', '*'])).toBeNull();
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
    expect(console.log).toHaveBeenCalledWith(
      'Symlinking from ../clone ██████████ 100% · Symlinked 1 skill',
    );
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

describe('defaultSpawn - capture', () => {
  it('reports a missing command as an error with no status', async () => {
    const r = await defaultSpawn('skl-x-no-such-command', [], true);
    expect(r.status).toBeNull();
    expect((r.error as NodeJS.ErrnoException | undefined)?.code).toBe('ENOENT');
  });

  it('keeps a multibyte character split across chunks intact', async () => {
    // "█" is e2 96 88; the last byte arrives in a later chunk
    const script =
      'process.stdout.write(Buffer.from([0xe2, 0x96]));' +
      'setTimeout(() => process.stdout.write(Buffer.from([0x88, 0x0a])), 50);';
    const r = await defaultSpawn(process.execPath, ['-e', script], true);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('█\n');
  });
});
