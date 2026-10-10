import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getLockPath } from '../lock/file';
import {
  detectScope,
  encodeClaudeProjectDir,
  findProjectRoot,
  isPathInProject,
  scopeHeader,
  scopeLockPath,
} from './scope';

describe('detectScope', () => {
  it('returns global when --global flag is set', () => {
    expect(
      detectScope({ global: true, cwd: '/Users/foo/projects/bar', home: '/Users/foo' }),
    ).toEqual({ global: true });
  });

  it('returns global when --root override is set', () => {
    expect(
      detectScope({ rootOverride: true, cwd: '/Users/foo/projects/bar', home: '/Users/foo' }),
    ).toEqual({ global: true });
  });

  it('returns global when cwd equals home', () => {
    expect(detectScope({ cwd: '/Users/foo', home: '/Users/foo' })).toEqual({ global: true });
  });

  it('treats home with trailing slash as home', () => {
    expect(detectScope({ cwd: '/Users/foo/', home: '/Users/foo' })).toEqual({ global: true });
  });

  it('case-insensitive home match (macOS)', () => {
    expect(detectScope({ cwd: '/Users/Foo', home: '/Users/foo' })).toEqual({ global: true });
  });

  it('falls back to cwd when no .git found', () => {
    expect(detectScope({ cwd: '/tmp/no-git-here', home: '/Users/foo' })).toEqual({
      global: false,
      projectRoot: '/tmp/no-git-here',
    });
  });
});

describe('isPathInProject', () => {
  it('exact match', () => {
    expect(isPathInProject('/a/b', '/a/b')).toBe(true);
  });
  it('subpath match', () => {
    expect(isPathInProject('/a/b/c', '/a/b')).toBe(true);
  });
  it('sibling does not match', () => {
    expect(isPathInProject('/a/bx', '/a/b')).toBe(false);
  });
  it('case-insensitive (macOS)', () => {
    expect(isPathInProject('/Users/Foo/Work/x', '/Users/foo/work/x')).toBe(true);
  });
});

describe('encodeClaudeProjectDir', () => {
  it('replaces slashes with dashes', () => {
    expect(encodeClaudeProjectDir('/Users/foo/work/skillio')).toBe('-Users-foo-work-skillio');
  });
});

describe('scopeHeader', () => {
  it('writes scope in lower case', () => {
    expect(scopeHeader(false)).toBe('Project scope');
    expect(scopeHeader(true)).toBe('Global scope');
  });
});

describe('findProjectRoot', () => {
  let tmp = '';
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns the nearest ancestor with .git', () => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-root-')));
    mkdirSync(join(tmp, '.git'));
    mkdirSync(join(tmp, 'a', 'b'), { recursive: true });
    expect(findProjectRoot(join(tmp, 'a', 'b'))).toBe(tmp);
  });

  it('accepts .git as a file (worktree, submodule) and picks the nearest one', () => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-root-')));
    mkdirSync(join(tmp, '.git'));
    mkdirSync(join(tmp, 'wt', 'src'), { recursive: true });
    writeFileSync(join(tmp, 'wt', '.git'), 'gitdir: ../.git/worktrees/wt\n');
    expect(findProjectRoot(join(tmp, 'wt', 'src'))).toBe(join(tmp, 'wt'));
  });

  it('falls back to cwd outside a git repo', () => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-root-')));
    expect(findProjectRoot(tmp)).toBe(tmp);
  });
});

describe('scopeLockPath', () => {
  let tmp = '';
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('puts the project lock in the project root', () => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'skl-root-')));
    mkdirSync(join(tmp, '.git'));
    mkdirSync(join(tmp, 'sub'));
    expect(scopeLockPath(false, join(tmp, 'sub'))).toBe(join(tmp, 'skills-lock.json'));
  });

  it('keeps the global lock path', () => {
    expect(scopeLockPath(true, '/anywhere')).toBe(getLockPath(true));
  });
});
