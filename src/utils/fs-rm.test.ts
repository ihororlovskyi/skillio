import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countFoldersAndFiles, rmSkillDir } from './fs-rm';

let TMP = '';

beforeEach(() => {
  TMP = join(tmpdir(), `skl-fsrm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TMP, { recursive: true, force: true });
  } catch {}
});

describe('rmSkillDir', () => {
  it('recursively removes a skill directory and reports file count', () => {
    const dir = join(TMP, 'skill');
    mkdirSync(join(dir, 'sub'), { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\n---\n');
    writeFileSync(join(dir, 'sub', 'a.ts'), 'export {};');

    const result = rmSkillDir(dir, { allowedRoots: [TMP] });
    expect(result.removed).toBe(true);
    expect(result.fileCount).toBe(2);
    expect(existsSync(dir)).toBe(false);
  });

  it('returns removed:false when path does not exist', () => {
    const result = rmSkillDir(join(TMP, 'nope'), { allowedRoots: [TMP] });
    expect(result.removed).toBe(false);
    expect(result.fileCount).toBe(0);
  });

  it('removes a live symlink without touching its target', () => {
    const target = join(TMP, 'real-skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'SKILL.md'), 'x');
    const link = join(TMP, 'link-skill');
    symlinkSync(target, link, 'dir');

    const result = rmSkillDir(link, { allowedRoots: [TMP] });
    expect(result.removed).toBe(true);
    expect(existsSync(link)).toBe(false);
    expect(existsSync(join(target, 'SKILL.md'))).toBe(true);
  });

  it('removes a dangling symlink (target already deleted)', () => {
    const target = join(TMP, 'real-skill');
    mkdirSync(target, { recursive: true });
    const link = join(TMP, 'link-skill');
    symlinkSync(target, link, 'dir');
    rmSync(target, { recursive: true, force: true });
    expect(() => lstatSync(link)).not.toThrow();

    const result = rmSkillDir(link, { allowedRoots: [TMP] });
    expect(result.removed).toBe(true);
    expect(() => lstatSync(link)).toThrow();
  });

  it('throws when target is outside allowed roots', () => {
    expect(() => rmSkillDir('/etc/passwd', { allowedRoots: [TMP] })).toThrow(
      /outside allowed roots/,
    );
  });
});

describe('countFoldersAndFiles', () => {
  it('counts nested folders and files, excluding the root directory itself', () => {
    const dir = join(TMP, 'skill');
    mkdirSync(join(dir, 'scripts', 'nested'), { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\n---\n');
    writeFileSync(join(dir, 'scripts', 'a.sh'), 'echo hi');
    writeFileSync(join(dir, 'scripts', 'nested', 'b.sh'), 'echo hi');

    expect(countFoldersAndFiles(dir)).toEqual({ folders: 2, files: 3 });
  });

  it('returns zero folders for a flat directory with only files', () => {
    const dir = join(TMP, 'flat');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), 'x');

    expect(countFoldersAndFiles(dir)).toEqual({ folders: 0, files: 1 });
  });

  it('returns zeros for an empty directory', () => {
    const dir = join(TMP, 'empty');
    mkdirSync(dir, { recursive: true });

    expect(countFoldersAndFiles(dir)).toEqual({ folders: 0, files: 0 });
  });
});
