import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rmSkillDir } from './fs-rm';

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

  it('throws when target is outside allowed roots', () => {
    expect(() => rmSkillDir('/etc/passwd', { allowedRoots: [TMP] })).toThrow(
      /outside allowed roots/,
    );
  });
});
