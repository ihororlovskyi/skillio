import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareVersions, readCache, writeCache } from './update-check';

describe('compareVersions', () => {
  it('detects patch bump', () => expect(compareVersions('0.1.5', '0.1.4')).toBeGreaterThan(0));
  it('detects minor bump', () => expect(compareVersions('0.2.0', '0.1.99')).toBeGreaterThan(0));
  it('detects major bump', () => expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0));
  it('lexically tricky double-digit patch', () =>
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0));
  it('returns 0 for equal versions', () => expect(compareVersions('1.2.3', '1.2.3')).toBe(0));
  it('returns negative when a < b', () =>
    expect(compareVersions('0.1.4', '0.1.5')).toBeLessThan(0));
  it('treats missing parts as 0', () => expect(compareVersions('1.0', '1.0.0')).toBe(0));
});

describe('cache read/write', () => {
  let TMP = '';
  beforeEach(() => {
    TMP = join(tmpdir(), `skillio-uc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it('returns undefined when cache file missing', () => {
    expect(readCache(join(TMP, 'missing.json'))).toBeUndefined();
  });
  it('round-trips a cache entry', () => {
    const path = join(TMP, 'cache.json');
    writeCache({ checkedAt: 1700000000000, latest: '0.1.5' }, path);
    expect(readCache(path)).toEqual({ checkedAt: 1700000000000, latest: '0.1.5' });
  });
  it('returns undefined on malformed JSON', () => {
    const path = join(TMP, 'bad.json');
    writeCache({ checkedAt: 1, latest: 'x' }, path);
    require('node:fs').writeFileSync(path, '{not json');
    expect(readCache(path)).toBeUndefined();
  });
});
