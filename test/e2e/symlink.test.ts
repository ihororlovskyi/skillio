import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './helpers';

let TMP = '';
let PROJ = '';

function seedSkill(root: string, name: string): void {
  mkdirSync(join(root, 'skills', name), { recursive: true });
  writeFileSync(join(root, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: test skill\n---\n`);
}

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skl-symlink-e2e-'));
  PROJ = join(TMP, 'proj');
  seedSkill(join(TMP, 'clone'), 'tdd');
  mkdirSync(join(PROJ, '.agents/skills/tdd'), { recursive: true });
  writeFileSync(join(PROJ, '.agents/skills/tdd/SKILL.md'), 'copy from npx skills add');
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('skl symlink', () => {
  it('sl -y replaces a copy, links both dirs and skips a space-prefixed name', () => {
    const { stdout, exitCode } = run(['sl', '../clone', '-s', 'tdd', ' scope-check', '-y'], PROJ);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Symlinked 1 skill from ../clone into .agents/skills, .claude/skills');
    for (const dir of ['.agents/skills', '.claude/skills']) {
      expect(lstatSync(join(PROJ, dir, 'tdd')).isSymbolicLink()).toBe(true);
      expect(readlinkSync(join(PROJ, dir, 'tdd'))).toBe('../../../clone/skills/tdd');
    }
    expect(existsSync(join(PROJ, '.claude/skills/ scope-check'))).toBe(false);
  });

  it('does not touch skills-lock.json', () => {
    const lock = '{\n  "version": 1,\n  "skills": {}\n}\n';
    writeFileSync(join(PROJ, 'skills-lock.json'), lock);
    expect(run(['sl', '../clone', '-s', 'tdd', '-y'], PROJ).exitCode).toBe(0);
    expect(readFileSync(join(PROJ, 'skills-lock.json'), 'utf8')).toBe(lock);
  });

  it('a second run without -y asks nothing and succeeds', () => {
    run(['symlink', '../clone', '-s', 'tdd', '-y'], PROJ);
    const { exitCode } = run(['symlink', '../clone', '-s', 'tdd'], PROJ);
    expect(exitCode).toBe(0);
    expect(run(['sym', '../clone', '-s', 'tdd'], PROJ).stdout).toContain('Symlinked 1 skill');
  });

  it('without -y and no TTY the copy stays (createConfirmer reads EOF as no)', () => {
    const { stdout, exitCode } = run(['sl', '../clone', '-s', 'tdd'], PROJ);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('.agents/skills/tdd - folder');
    expect(stdout).toContain('Replace 1 existing skill?');
    expect(lstatSync(join(PROJ, '.agents/skills/tdd')).isDirectory()).toBe(true);
  });

  it('-a goes through unmerged and -g is rejected', () => {
    const ok = run(['sl', '../clone', '-s', 'tdd', '-a', 'claude-code', 'codex', '-y'], PROJ);
    expect(ok.exitCode).toBe(0);
    const global = run(['-g', 'sl', '../clone', '-s', 'tdd'], PROJ);
    expect(global.exitCode).toBe(1);
    expect(global.stderr).toContain('-g/--global is not supported yet');
  });

  it('root help lists install and symlink', () => {
    const { stdout } = run(['-h'], PROJ);
    expect(stdout).toContain('install, i');
    expect(stdout).toContain('symlink, sym, sl');
  });
});
