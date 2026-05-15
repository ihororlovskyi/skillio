import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { selectMock, multiSelectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  multiSelectMock: vi.fn(),
}));
vi.mock('../utils/prompt', () => ({
  select: (params: unknown) => selectMock(params),
  multiSelect: (params: unknown) => multiSelectMock(params),
}));

import { setColorEnabled } from '../utils/ansi';

describe('runPicker — remove sub-picker (unit)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'skl-picker-unit-'));
    selectMock.mockReset();
    multiSelectMock.mockReset();
    setColorEnabled(true);
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    setColorEnabled(false);
  });

  function seed(opts: { lock?: Record<string, unknown>; claudeNames?: string[] }): string {
    const lockPath = join(tmp, 'skills-lock.json');
    writeFileSync(lockPath, JSON.stringify({ skills: opts.lock ?? {} }));
    for (const name of opts.claudeNames ?? []) {
      mkdirSync(join(tmp, '.claude', 'skills', name), { recursive: true });
      writeFileSync(join(tmp, '.claude', 'skills', name, 'SKILL.md'), '---\nname: x\n---\nbody');
    }
    return lockPath;
  }

  it('sub-picker options: in-lock alphabetic first, then orphan with red "(orphan)" suffix', async () => {
    seed({
      lock: { 'b-locked': {}, 'a-locked': {} },
      claudeNames: ['b-locked', 'd-orphan', 'c-orphan'],
    });
    selectMock.mockResolvedValueOnce('remove');
    multiSelectMock.mockResolvedValueOnce(null);

    const cwdBefore = process.cwd();
    process.chdir(tmp);
    try {
      const { runPicker } = await import('./picker');
      const status = await runPicker({ global: false });
      expect(status).toBe(0);
    } finally {
      process.chdir(cwdBefore);
    }

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(multiSelectMock).toHaveBeenCalledTimes(1);
    const subPickerCall = multiSelectMock.mock.calls[0]?.[0] as {
      title: string;
      options: Array<{ value: string; label: string }>;
    };
    expect(subPickerCall.title).toMatch(/skills to remove/i);
    const labels = subPickerCall.options.map((o) => o.label);
    const values = subPickerCall.options.map((o) => o.value);

    const ESC = '\x1b';
    expect(values).toEqual(['a-locked', 'b-locked', 'c-orphan', 'd-orphan']);
    expect(labels[2]).toContain('c-orphan');
    expect(labels[2]).toContain(`${ESC}[31m`);
    expect(labels[2]).toContain('(orphan)');
    expect(labels[3]).toContain(`${ESC}[31m`);
    expect(labels[3]).toContain('(orphan)');
    expect(labels[0]).not.toContain(`${ESC}[31m`);
    expect(labels[1]).not.toContain(`${ESC}[31m`);
  });

  it('main menu cancel/quit returns 0 without invoking sub-picker', async () => {
    seed({ lock: { foo: {} } });
    selectMock.mockResolvedValueOnce(null);

    const cwdBefore = process.cwd();
    process.chdir(tmp);
    try {
      const { runPicker } = await import('./picker');
      const status = await runPicker({ global: false });
      expect(status).toBe(0);
    } finally {
      process.chdir(cwdBefore);
    }
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(multiSelectMock).toHaveBeenCalledTimes(0);
  });

  it('sub-picker ESC returns 0 (no spawn) without re-entering main menu', async () => {
    seed({ lock: { foo: {} } });
    selectMock.mockResolvedValueOnce('remove');
    multiSelectMock.mockResolvedValueOnce(null);

    const cwdBefore = process.cwd();
    process.chdir(tmp);
    try {
      const { runPicker } = await import('./picker');
      const status = await runPicker({ global: false });
      expect(status).toBe(0);
    } finally {
      process.chdir(cwdBefore);
    }
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(multiSelectMock).toHaveBeenCalledTimes(1);
  });

  it('empty scope: prints "No skills found in scope." and returns 0', async () => {
    seed({});
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };
    selectMock.mockResolvedValueOnce('remove');

    const cwdBefore = process.cwd();
    process.chdir(tmp);
    try {
      const { runPicker } = await import('./picker');
      const status = await runPicker({ global: false });
      expect(status).toBe(0);
    } finally {
      process.chdir(cwdBefore);
      console.log = orig;
    }
    expect(logs.some((l) => l.includes('No skills found in scope'))).toBe(true);
  });
});
