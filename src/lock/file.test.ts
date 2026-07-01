import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countLockLinesToRemove,
  getLockPath,
  readLock,
  removeSkillFromLock,
  writeLock,
} from './file';

const TMP = join(tmpdir(), `skillum-lock-${Date.now()}`);

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('readLock', () => {
  it('returns empty skills when file does not exist', () => {
    expect(readLock(join(TMP, 'missing.json'))).toEqual({ skills: {} });
  });
  it('reads an existing lock file', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { 'skill-foo': {} } });
    expect(readLock(path)).toEqual({ skills: { 'skill-foo': {} } });
  });
});

describe('writeLock', () => {
  it('writes and reads back correctly', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { foo: {}, bar: {} } });
    expect(readLock(path).skills).toHaveProperty('foo');
    expect(readLock(path).skills).toHaveProperty('bar');
  });
});

describe('removeSkillFromLock', () => {
  it('removes a skill and keeps the rest', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { 'skill-foo': {}, 'skill-bar': {} } });
    const result = removeSkillFromLock(path, 'skill-foo');
    expect(result.removed).toBe(true);
    expect(readLock(path).skills).not.toHaveProperty('skill-foo');
    expect(readLock(path).skills).toHaveProperty('skill-bar');
  });
  it('returns removed: false when skill is absent', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: {} });
    expect(removeSkillFromLock(path, 'nonexistent').removed).toBe(false);
  });
  it('returns removed: false when file does not exist', () => {
    expect(removeSkillFromLock(join(TMP, 'missing.json'), 'foo').removed).toBe(false);
  });
});

describe('getLockPath', () => {
  it('returns skills-lock.json for local scope', () => {
    expect(getLockPath(false)).toBe('skills-lock.json');
  });
  it('contains .agents and .skill-lock.json for global scope', () => {
    const p = getLockPath(true);
    expect(p).toContain('.agents');
    expect(p).toContain('.skill-lock.json');
  });
});

describe('countLockLinesToRemove', () => {
  it('returns 0 when the lock file does not exist', () => {
    expect(countLockLinesToRemove(join(TMP, 'missing.json'), ['foo'])).toBe(0);
  });

  it('returns 0 when none of the names are in the lock', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { foo: {} } });
    expect(countLockLinesToRemove(path, ['bar'])).toBe(0);
  });

  it('counts the lines removed for a single matching key', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { foo: {} } });
    expect(countLockLinesToRemove(path, ['foo'])).toBeGreaterThan(0);
  });

  it('does not modify the file on disk', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { foo: {} } });
    countLockLinesToRemove(path, ['foo']);
    expect(readLock(path).skills).toHaveProperty('foo');
  });

  it('counts more lines removed for two matching keys than for one', () => {
    const path = join(TMP, 'lock.json');
    writeLock(path, { skills: { foo: {}, bar: {} } });
    const oneKey = countLockLinesToRemove(path, ['foo']);
    const bothKeys = countLockLinesToRemove(path, ['foo', 'bar']);
    expect(bothKeys).toBeGreaterThan(oneKey);
  });
});
