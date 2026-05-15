import type { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { multiSelect, select } from './prompt';

function makeFakeTTY(): {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
  emitKey: (name: string, modifiers?: { ctrl?: boolean }) => void;
} {
  const inputBase = new PassThrough();
  const outputBase = new PassThrough();
  outputBase.resume();
  const input = inputBase as unknown as NodeJS.ReadStream;
  const output = outputBase as unknown as NodeJS.WriteStream;
  (input as { isTTY?: boolean }).isTTY = true;
  (output as { isTTY?: boolean }).isTTY = true;
  (input as { setRawMode?: (mode: boolean) => NodeJS.ReadStream }).setRawMode = () => input;
  return {
    input,
    output,
    emitKey(name, modifiers = {}) {
      (input as unknown as EventEmitter).emit('keypress', '', { name, ...modifiers });
    },
  };
}

const OPTIONS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

describe('select', () => {
  it('returns null when input is not a TTY', async () => {
    const input = new PassThrough() as unknown as NodeJS.ReadStream;
    const output = new PassThrough() as unknown as NodeJS.WriteStream;
    (input as { isTTY?: boolean }).isTTY = false;
    (output as { isTTY?: boolean }).isTTY = false;
    expect(
      await select({ title: 't', options: [{ value: 'a', label: 'A' }], input, output }),
    ).toBeNull();
  });

  it('returns the cursor value on Enter at index 0', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('return');
    expect(await p).toBe('a');
  });

  it('down then Enter selects the next option', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('down');
    emitKey('return');
    expect(await p).toBe('b');
  });

  it('down clamps at last index', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('down');
    emitKey('down');
    emitKey('down');
    emitKey('down');
    emitKey('return');
    expect(await p).toBe('c');
  });

  it('up clamps at first index', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('up');
    emitKey('up');
    emitKey('return');
    expect(await p).toBe('a');
  });

  it('q cancels and returns null', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('q');
    expect(await p).toBeNull();
  });

  it('escape cancels and returns null', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('escape');
    expect(await p).toBeNull();
  });

  it('ctrl+c cancels and returns null', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = select({ title: 't', options: OPTIONS, input, output });
    emitKey('c', { ctrl: true });
    expect(await p).toBeNull();
  });
});

describe('multiSelect', () => {
  it('returns null when input is not a TTY', async () => {
    const input = new PassThrough() as unknown as NodeJS.ReadStream;
    const output = new PassThrough() as unknown as NodeJS.WriteStream;
    (input as { isTTY?: boolean }).isTTY = false;
    (output as { isTTY?: boolean }).isTTY = false;
    expect(
      await multiSelect({ title: 't', options: [{ value: 'a', label: 'A' }], input, output }),
    ).toBeNull();
  });

  it('Enter with no selections returns empty array', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('return');
    expect(await p).toEqual([]);
  });

  it('Space toggles selection on current cursor and Enter returns selected values', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('space'); // toggle 'a' on (cursor=0)
    emitKey('down');
    emitKey('down');
    emitKey('space'); // toggle 'c' on (cursor=2)
    emitKey('return');
    expect(await p).toEqual(['a', 'c']);
  });

  it('Space twice on same option toggles off', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('space'); // 'a' on
    emitKey('space'); // 'a' off
    emitKey('return');
    expect(await p).toEqual([]);
  });

  it('escape cancels with null even if items were selected', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('space');
    emitKey('escape');
    expect(await p).toBeNull();
  });

  it('q cancels with null', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('q');
    expect(await p).toBeNull();
  });

  it('ctrl+c cancels with null', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('c', { ctrl: true });
    expect(await p).toBeNull();
  });

  it('selections are returned in option order regardless of click order', async () => {
    const { input, output, emitKey } = makeFakeTTY();
    const p = multiSelect({ title: 't', options: OPTIONS, input, output });
    emitKey('down');
    emitKey('down');
    emitKey('space'); // 'c' on
    emitKey('up');
    emitKey('up');
    emitKey('space'); // 'a' on
    emitKey('return');
    expect(await p).toEqual(['a', 'c']);
  });
});
