import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSymlinkArgs, planSymlinks, runSymlink } from './symlink';

describe('parseSymlinkArgs', () => {
  it('collects several -s and -a values', () => {
    expect(
      parseSymlinkArgs([
        '../skills',
        '-s',
        'tdd',
        'cross-review',
        '-a',
        'codex',
        'claude-code',
        '-y',
      ]),
    ).toEqual({
      kind: 'ok',
      args: {
        source: '../skills',
        skills: ['tdd', 'cross-review'],
        agents: ['codex', 'claude-code'],
        yes: true,
      },
    });
  });

  it('defaults agents to both and yes to false', () => {
    expect(parseSymlinkArgs(['../skills', '-s', 'tdd'])).toEqual({
      kind: 'ok',
      args: { source: '../skills', skills: ['tdd'], agents: ['codex', 'claude-code'], yes: false },
    });
  });

  it('keeps space-prefixed names as -s values', () => {
    const r = parseSymlinkArgs(['../skills', '-s', 'tdd', ' scope-check']);
    expect(r.kind === 'ok' && r.args.skills).toEqual(['tdd', ' scope-check']);
  });

  it('accepts long forms and dedupes agents', () => {
    expect(
      parseSymlinkArgs([
        '../skills',
        '--skill',
        'tdd',
        '--agent',
        'claude-code',
        'claude-code',
        '--yes',
      ]),
    ).toEqual({
      kind: 'ok',
      args: { source: '../skills', skills: ['tdd'], agents: ['claude-code'], yes: true },
    });
  });

  it('returns help for -h or --help anywhere', () => {
    expect(parseSymlinkArgs(['-h'])).toEqual({ kind: 'help' });
    expect(parseSymlinkArgs(['../skills', '-s', 'tdd', '--help'])).toEqual({ kind: 'help' });
  });

  it.each([
    [['-s', 'tdd'], 'missing <path>'],
    [['../skills'], 'missing -s'],
    [['../skills', '-s'], '-s needs at least one value'],
    [['../skills', '-s', 'tdd', '-a', 'cursor'], 'Unknown agent: "cursor"'],
    [['../skills', '-s', 'tdd', '--force'], 'Unknown option: --force'],
    [['../skills', '-s', 'tdd', '-g'], '-g/--global is not supported yet'],
    [['../a', '../b', '-s', 'tdd'], 'takes one source'],
    [['../skills', '-s', '..'], 'invalid skill name ".."'],
    [['../skills', '-s', '.'], 'invalid skill name "."'],
    [['../skills', '-s', 'tdd', 'a/b'], 'invalid skill name "a/b"'],
  ])('rejects %j', (argv, message) => {
    const r = parseSymlinkArgs(argv);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain(message);
  });
});

const BOTH = ['.agents/skills', '.claude/skills'];

let tmp = '';
let clone = '';
let proj = '';

function seedSkill(root: string, name: string): void {
  mkdirSync(join(root, 'skills', name), { recursive: true });
  writeFileSync(
    join(root, 'skills', name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test skill\n---\n`,
  );
}

describe('planSymlinks / runSymlink', () => {
  beforeEach(() => {
    // realpath: on macOS tmpdir() is under the /var -> /private/var symlink, and planSymlinks
    // computes targets from physical dirs
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-symlink-unit-')));
    clone = join(tmp, 'clone');
    proj = join(tmp, 'proj');
    mkdirSync(proj);
    seedSkill(clone, 'tdd');
    seedSkill(clone, 'cross-review');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('planSymlinks classifies new, same and replace', () => {
    mkdirSync(join(proj, '.agents/skills/tdd'), { recursive: true });
    mkdirSync(join(proj, '.claude/skills'), { recursive: true });
    symlinkSync('../../../clone/skills/tdd', join(proj, '.claude/skills/tdd'));
    const steps = planSymlinks({
      cwd: proj,
      sourceAbs: clone,
      names: ['tdd', 'cross-review'],
      dirs: BOTH,
    });
    expect(steps.map((s) => [s.dir, s.name, s.action, s.existing])).toEqual([
      ['.agents/skills', 'tdd', 'replace', 'folder'],
      ['.claude/skills', 'tdd', 'same', 'symlink'],
      ['.agents/skills', 'cross-review', 'new', 'none'],
      ['.claude/skills', 'cross-review', 'new', 'none'],
    ]);
    expect(steps[0]?.target).toBe('../../../clone/skills/tdd');
  });

  it('planSymlinks treats a symlink to another target, even a dangling one, as replace', () => {
    mkdirSync(join(proj, '.agents/skills'), { recursive: true });
    symlinkSync('../../missing/tdd', join(proj, '.agents/skills/tdd'));
    const [step] = planSymlinks({
      cwd: proj,
      sourceAbs: clone,
      names: ['tdd'],
      dirs: ['.agents/skills'],
    });
    expect(step).toMatchObject({
      action: 'replace',
      existing: 'symlink',
      existingTarget: '../../missing/tdd',
    });
  });

  it('links into both dirs, replaces a copy with -y and skips space-prefixed names', async () => {
    mkdirSync(join(proj, '.agents/skills/tdd'), { recursive: true });
    writeFileSync(join(proj, '.agents/skills/tdd/SKILL.md'), 'copy');
    const confirm = vi.fn(async (_q: string) => true);
    const status = await runSymlink(['../clone', '-s', 'tdd', ' scope-check', '-y'], {
      cwd: proj,
      confirm,
    });
    expect(status).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    for (const dir of BOTH) {
      expect(lstatSync(join(proj, dir, 'tdd')).isSymbolicLink()).toBe(true);
      expect(readlinkSync(join(proj, dir, 'tdd'))).toBe('../../../clone/skills/tdd');
      expect(existsSync(join(proj, dir, ' scope-check'))).toBe(false);
    }
    expect(console.log).toHaveBeenCalledWith(
      'Symlinked 1 skill from ../clone into .agents/skills, .claude/skills',
    );
  });

  it('maps -a claude-code to .claude/skills only', async () => {
    const status = await runSymlink(
      ['../clone', '-s', 'tdd', 'cross-review', '-a', 'claude-code'],
      {
        cwd: proj,
      },
    );
    expect(status).toBe(0);
    expect(existsSync(join(proj, '.agents'))).toBe(false);
    expect(readlinkSync(join(proj, '.claude/skills/cross-review'))).toBe(
      '../../../clone/skills/cross-review',
    );
    expect(console.log).toHaveBeenCalledWith(
      'Symlinked 2 skills from ../clone into .claude/skills',
    );
  });

  it('is idempotent: a second run without -y asks nothing', async () => {
    expect(await runSymlink(['../clone', '-s', 'tdd', '-y'], { cwd: proj })).toBe(0);
    const confirm = vi.fn(async (_q: string) => false);
    expect(await runSymlink(['../clone', '-s', 'tdd'], { cwd: proj, confirm })).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before replacing a copy and changes nothing on no', async () => {
    mkdirSync(join(proj, '.claude/skills/tdd'), { recursive: true });
    const confirm = vi.fn(async (_q: string) => false);
    const status = await runSymlink(['../clone', '-s', 'tdd', 'cross-review'], {
      cwd: proj,
      confirm,
    });
    expect(status).toBe(1);
    expect(confirm).toHaveBeenCalledWith('Replace 1 existing skill?');
    expect(console.log).toHaveBeenCalledWith('.claude/skills/tdd - folder');
    expect(lstatSync(join(proj, '.claude/skills/tdd')).isDirectory()).toBe(true);
    expect(existsSync(join(proj, '.agents/skills/cross-review'))).toBe(false);
  });

  it('replaces a copy after yes', async () => {
    mkdirSync(join(proj, '.claude/skills/tdd'), { recursive: true });
    const confirm = vi.fn(async (_q: string) => true);
    expect(await runSymlink(['../clone', '-s', 'tdd'], { cwd: proj, confirm })).toBe(0);
    expect(lstatSync(join(proj, '.claude/skills/tdd')).isSymbolicLink()).toBe(true);
  });

  it('fails before any change when a skill is missing in the clone', async () => {
    expect(await runSymlink(['../clone', '-s', 'tdd', 'nope', '-y'], { cwd: proj })).toBe(1);
    expect(existsSync(join(proj, '.agents'))).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('nope'));
  });

  it('rejects ".." with -y and keeps .agents intact', async () => {
    writeFileSync(join(clone, 'SKILL.md'), '---\nname: root\n---\n');
    mkdirSync(join(proj, '.agents/skills/keep'), { recursive: true });
    expect(await runSymlink(['../clone', '-s', '..', '-y'], { cwd: proj })).toBe(1);
    expect(existsSync(join(proj, '.agents/skills/keep'))).toBe(true);
  });

  it('refuses to replace a folder that is the source itself', async () => {
    seedSkill(join(proj, '.agents'), 'tdd');
    expect(await runSymlink(['.agents', '-s', 'tdd', '-y'], { cwd: proj })).toBe(1);
    expect(existsSync(join(proj, '.agents/skills/tdd/SKILL.md'))).toBe(true);
    expect(lstatSync(join(proj, '.agents/skills/tdd')).isDirectory()).toBe(true);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('is the source itself'));
  });

  it('refuses to replace a symlink the source is reached through', async () => {
    mkdirSync(join(proj, '.agents/skills'), { recursive: true });
    symlinkSync('../../../clone/skills/tdd', join(proj, '.agents/skills/tdd'));
    expect(await runSymlink(['.agents', '-s', 'tdd', '-y'], { cwd: proj })).toBe(1);
    expect(readlinkSync(join(proj, '.agents/skills/tdd'))).toBe('../../../clone/skills/tdd');
    expect(existsSync(join(proj, '.claude'))).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('is the source itself'));
  });

  it('refuses to replace a symlink the source is reached through via an alias dir', async () => {
    mkdirSync(join(proj, '.agents/skills'), { recursive: true });
    symlinkSync('../../../clone/skills/tdd', join(proj, '.agents/skills/tdd'));
    symlinkSync('.agents', join(proj, 'alias'));
    expect(await runSymlink(['alias', '-s', 'tdd', '-a', 'codex', '-y'], { cwd: proj })).toBe(1);
    expect(readlinkSync(join(proj, '.agents/skills/tdd'))).toBe('../../../clone/skills/tdd');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('is the source itself'));
  });

  it('follows a link target with symlink/.. physically, not lexically', async () => {
    seedSkill(join(proj, '.agents/skills/victim'), 'unused');
    mkdirSync(join(proj, '.agents/skills/victim/deep'));
    mkdirSync(join(proj, '.agents/skills/victim/actual'));
    writeFileSync(join(proj, '.agents/skills/victim/actual/SKILL.md'), '---\nname: tdd\n---\n');
    seedSkill(clone, 'victim');
    rmSync(join(clone, 'skills/tdd'), { recursive: true, force: true });
    symlinkSync(join(proj, '.agents/skills/victim/deep'), join(clone, 'skills/bridge'));
    symlinkSync('bridge/../actual', join(clone, 'skills/tdd'));
    expect(
      await runSymlink(['../clone', '-s', 'victim', 'tdd', '-a', 'codex', '-y'], { cwd: proj }),
    ).toBe(1);
    expect(existsSync(join(proj, '.agents/skills/victim/actual/SKILL.md'))).toBe(true);
  });

  it('replaces a foreign and a dangling symlink with -y', async () => {
    mkdirSync(join(proj, '.agents/skills'), { recursive: true });
    symlinkSync('../../../clone/skills/cross-review', join(proj, '.agents/skills/tdd'));
    symlinkSync('../../nowhere', join(proj, '.agents/skills/cross-review'));
    expect(
      await runSymlink(['../clone', '-s', 'tdd', 'cross-review', '-a', 'codex', '-y'], {
        cwd: proj,
      }),
    ).toBe(0);
    expect(readlinkSync(join(proj, '.agents/skills/tdd'))).toBe('../../../clone/skills/tdd');
    expect(readlinkSync(join(proj, '.agents/skills/cross-review'))).toBe(
      '../../../clone/skills/cross-review',
    );
  });

  it('refuses to replace a folder that holds the source of another selected skill', async () => {
    seedSkill(join(proj, '.agents/skills/tdd'), 'nested');
    rmSync(join(clone, 'skills/cross-review'), { recursive: true, force: true });
    symlinkSync(join(proj, '.agents/skills/tdd/skills/nested'), join(clone, 'skills/cross-review'));
    expect(await runSymlink(['../clone', '-s', 'tdd', 'cross-review', '-y'], { cwd: proj })).toBe(
      1,
    );
    expect(existsSync(join(proj, '.agents/skills/tdd/skills/nested/SKILL.md'))).toBe(true);
  });

  it('computes the target from the physical dir when .agents/skills is a symlink', async () => {
    const shared = join(tmp, 'shared/deep/skills');
    mkdirSync(shared, { recursive: true });
    mkdirSync(join(proj, '.agents'));
    symlinkSync(shared, join(proj, '.agents/skills'));
    expect(await runSymlink(['../clone', '-s', 'tdd', '-a', 'codex', '-y'], { cwd: proj })).toBe(0);
    expect(existsSync(join(proj, '.agents/skills/tdd/SKILL.md'))).toBe(true);
    expect(realpathSync(join(proj, '.agents/skills/tdd'))).toBe(join(clone, 'skills/tdd'));
  });

  it('links once when .claude/skills is a symlink to .agents/skills', async () => {
    mkdirSync(join(proj, '.agents/skills'), { recursive: true });
    mkdirSync(join(proj, '.claude'));
    symlinkSync('../.agents/skills', join(proj, '.claude/skills'));
    expect(await runSymlink(['../clone', '-s', 'tdd', '-y'], { cwd: proj })).toBe(0);
    expect(existsSync(join(proj, '.claude/skills/tdd/SKILL.md'))).toBe(true);
    expect(realpathSync(join(proj, '.agents/skills/tdd'))).toBe(join(clone, 'skills/tdd'));
  });

  it('planSymlinks marks a plain file as replace', () => {
    mkdirSync(join(proj, '.claude/skills'), { recursive: true });
    writeFileSync(join(proj, '.claude/skills/tdd'), 'not a skill');
    const [step] = planSymlinks({
      cwd: proj,
      sourceAbs: clone,
      names: ['tdd'],
      dirs: ['.claude/skills'],
    });
    expect(step).toMatchObject({ action: 'replace', existing: 'file' });
  });

  it('fails when the source is not a directory', async () => {
    expect(await runSymlink(['../missing', '-s', 'tdd'], { cwd: proj })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('../missing'));
  });

  it('dedupes repeated names', async () => {
    expect(await runSymlink(['../clone', '-s', 'tdd', 'tdd', '-y'], { cwd: proj })).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      'Symlinked 1 skill from ../clone into .agents/skills, .claude/skills',
    );
  });

  it('prints help and returns 1 on argument errors', async () => {
    expect(await runSymlink(['-h'], { cwd: proj })).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('skillio symlink <path>'));
    expect(await runSymlink(['../clone'], { cwd: proj })).toBe(1);
    expect(console.error).toHaveBeenCalledWith('skl symlink: missing -s <names...>');
  });
});
