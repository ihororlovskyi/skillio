import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countFrontmatterTokens,
  extractFrontmatter,
  findSkillFile,
  getSkillPathCandidates,
} from './skill-files';

describe('extractFrontmatter', () => {
  it('extracts content between --- markers', () => {
    const fm = extractFrontmatter('---\nname: x\ndescription: y\n---\n\n# Body\n');
    expect(fm).toBe('name: x\ndescription: y');
  });
  it('returns undefined when no frontmatter', () => {
    expect(extractFrontmatter('# Just a heading\n')).toBeUndefined();
  });
  it('handles CRLF line endings', () => {
    const fm = extractFrontmatter('---\r\nname: x\r\n---\r\n\r\n# Body');
    expect(fm).toBe('name: x');
  });
});

describe('getSkillPathCandidates', () => {
  it('returns single local path next to lock file', () => {
    const paths = getSkillPathCandidates('foo', '/repo/skills-lock.json', false);
    expect(paths).toEqual(['/repo/.claude/skills/foo/SKILL.md']);
  });
  it('returns global candidates when isGlobal=true', () => {
    const paths = getSkillPathCandidates('foo', '/anywhere/.skill-lock.json', true);
    expect(paths.length).toBe(2);
    expect(paths[0]).toContain('.claude/skills/foo/SKILL.md');
    expect(paths[1]).toContain('.agents/skills/foo/SKILL.md');
  });
});

describe('findSkillFile + countFrontmatterTokens', () => {
  let TMP = '';
  beforeEach(() => {
    TMP = join(tmpdir(), `skillio-skf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(TMP, '.claude', 'skills', 'present'), { recursive: true });
    writeFileSync(
      join(TMP, '.claude', 'skills', 'present', 'SKILL.md'),
      '---\nname: present\ndescription: hi\n---\n\n# Body\n',
    );
    writeFileSync(join(TMP, 'skills-lock.json'), '{}');
  });
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it('finds an existing skill file', () => {
    const f = findSkillFile('present', join(TMP, 'skills-lock.json'), false);
    expect(f).toContain('present/SKILL.md');
  });
  it('returns undefined for missing skill', () => {
    const f = findSkillFile('absent', join(TMP, 'skills-lock.json'), false);
    expect(f).toBeUndefined();
  });
  it('counts tokens in frontmatter only', () => {
    const f = findSkillFile('present', join(TMP, 'skills-lock.json'), false);
    const n = countFrontmatterTokens(f as string);
    expect(typeof n).toBe('number');
    expect(n).toBeGreaterThan(0);
  });
});
