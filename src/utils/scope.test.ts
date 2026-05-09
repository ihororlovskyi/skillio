import { describe, expect, it } from 'vitest';
import { detectScope, encodeClaudeProjectDir, isPathInProject } from './scope';

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
