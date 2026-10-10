import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findJsonlFiles, isRecentEntry, readJsonlLines } from './jsonl';

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, statSync: vi.fn(fs.statSync) };
});

const fsError = (code: string) => Object.assign(new Error(code), { code });

let TMP: string;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skl-jsonl-'));
});
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

  it('yields nothing for a missing directory', () => {
    expect([...findJsonlFiles(join(TMP, 'missing'))]).toEqual([]);
  });

  it('rethrows errors other than a missing directory', () => {
    const file = join(TMP, 'file.jsonl');
    writeFileSync(file, '');
    expect(() => [...findJsonlFiles(file)]).toThrow(/ENOTDIR/);
  });

  it('skips a file deleted between readdir and stat', () => {
    writeFileSync(join(TMP, 'gone.jsonl'), '');
    writeFileSync(join(TMP, 'kept.jsonl'), '');
    vi.mocked(statSync).mockImplementationOnce(() => {
      throw fsError('ENOENT');
    });
    expect([...findJsonlFiles(TMP, new Date(0))]).toHaveLength(1);
  });

  it('rethrows stat errors other than a missing file', () => {
    writeFileSync(join(TMP, 'locked.jsonl'), '');
    vi.mocked(statSync).mockImplementationOnce(() => {
      throw fsError('EACCES');
    });
    expect(() => [...findJsonlFiles(TMP, new Date(0))]).toThrow('EACCES');
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

  it('returns false for entries without timestamp/ts (no signal → not recent)', () => {
    expect(isRecentEntry({ type: 'other' }, since)).toBe(false);
  });

  it('returns false for null (no signal)', () => {
    expect(isRecentEntry(null, since)).toBe(false);
  });
});
