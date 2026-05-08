import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findJsonlFiles, isRecentEntry, readJsonlLines } from './jsonl';

const TMP = join(tmpdir(), `skillum-jsonl-${Date.now()}`);

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('findJsonlFiles', () => {
  it('yields .jsonl files in a directory', () => {
    writeFileSync(join(TMP, 'a.jsonl'), '');
    writeFileSync(join(TMP, 'b.txt'), '');
    const found = [...findJsonlFiles(TMP)];
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('a.jsonl');
  });

  it('recurses into subdirectories', () => {
    const sub = join(TMP, 'sub');
    mkdirSync(sub);
    writeFileSync(join(sub, 'nested.jsonl'), '');
    const found = [...findJsonlFiles(TMP)];
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('nested.jsonl');
  });

  it('returns all files when no since filter', () => {
    writeFileSync(join(TMP, 'x.jsonl'), '');
    writeFileSync(join(TMP, 'y.jsonl'), '');
    expect([...findJsonlFiles(TMP)]).toHaveLength(2);
  });
});

describe('readJsonlLines', () => {
  it('parses valid JSON lines', () => {
    const file = join(TMP, 'test.jsonl');
    writeFileSync(file, '{"a":1}\n{"b":2}\n');
    expect(readJsonlLines(file)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('skips empty lines and invalid JSON', () => {
    const file = join(TMP, 'test.jsonl');
    writeFileSync(file, '{"ok":true}\nnot-json\n\n{"also":true}\n');
    expect(readJsonlLines(file)).toHaveLength(2);
  });
});

describe('isRecentEntry', () => {
  const since = new Date('2026-05-01T00:00:00Z');

  it('returns true for entries with recent timestamp', () => {
    expect(isRecentEntry({ timestamp: '2026-05-06T10:00:00Z' }, since)).toBe(true);
  });

  it('returns false for entries with old timestamp', () => {
    expect(isRecentEntry({ timestamp: '2020-01-01T00:00:00Z' }, since)).toBe(false);
  });

  it('returns true for entries with recent ts (unix seconds)', () => {
    expect(isRecentEntry({ ts: 1778025600 }, since)).toBe(true); // 2026-05-06
  });

  it('returns false for entries with old ts', () => {
    expect(isRecentEntry({ ts: 1000000 }, since)).toBe(false); // 1970
  });

  it('returns true for entries without timestamp (unknown shape)', () => {
    expect(isRecentEntry({ type: 'other' }, since)).toBe(true);
  });

  it('returns true for null', () => {
    expect(isRecentEntry(null, since)).toBe(true);
  });
});
