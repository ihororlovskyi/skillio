import { PassThrough, Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { confirm, createConfirmer } from './confirm';

function streamFromString(s: string): Readable {
  return Readable.from([s]);
}

function nullSink(): Writable {
  return new Writable({ write: (_chunk, _enc, cb) => cb() });
}

describe('confirm — non-TTY (line-based fallback)', () => {
  it('returns true on "y"', async () => {
    const result = await confirm('Proceed?', {
      input: streamFromString('y\n'),
      output: nullSink(),
    });
    expect(result).toBe(true);
  });

  it('returns true on "yes"', async () => {
    const result = await confirm('Proceed?', {
      input: streamFromString('yes\n'),
      output: nullSink(),
    });
    expect(result).toBe(true);
  });

  it('returns false on empty input (default N)', async () => {
    const result = await confirm('Proceed?', {
      input: streamFromString('\n'),
      output: nullSink(),
    });
    expect(result).toBe(false);
  });

  it('returns false on "n"', async () => {
    const result = await confirm('Proceed?', {
      input: streamFromString('n\n'),
      output: nullSink(),
    });
    expect(result).toBe(false);
  });
});

describe('confirm — TTY raw-mode (single keypress)', () => {
  it('single "y" keypress resolves true without Enter', async () => {
    const mockInput = new PassThrough() as unknown as NodeJS.ReadStream;
    mockInput.isTTY = true;
    mockInput.setRawMode = (_mode: boolean) => mockInput;

    const mockOutput = new PassThrough() as unknown as NodeJS.WriteStream;
    mockOutput.isTTY = true;
    const written: string[] = [];
    mockOutput.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };

    const resultPromise = confirm('Test?', { input: mockInput, output: mockOutput });

    await new Promise<void>((r) => setImmediate(r));
    mockInput.emit('data', Buffer.from('y'));

    const result = await resultPromise;
    expect(result).toBe(true);
    expect(written.join('')).toContain('y');
  });

  it('single "n" keypress resolves false', async () => {
    const mockInput = new PassThrough() as unknown as NodeJS.ReadStream;
    mockInput.isTTY = true;
    mockInput.setRawMode = (_mode: boolean) => mockInput;

    const mockOutput = new PassThrough() as unknown as NodeJS.WriteStream;
    mockOutput.isTTY = true;
    mockOutput.write = (_chunk: unknown) => true;

    const resultPromise = confirm('Test?', { input: mockInput, output: mockOutput });

    await new Promise<void>((r) => setImmediate(r));
    mockInput.emit('data', Buffer.from('n'));

    const result = await resultPromise;
    expect(result).toBe(false);
  });
});

describe('confirm — [y/n] prompt text', () => {
  it('writes the [y/n] suffix (non-TTY)', async () => {
    const chunks: string[] = [];
    const output = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(String(chunk));
        cb();
      },
    });
    await confirm('Proceed?', { input: streamFromString('y\n'), output });
    expect(chunks.join('')).toContain('[y/n]');
  });

  it('writes the [y/n] suffix (TTY)', async () => {
    const mockInput = new PassThrough() as unknown as NodeJS.ReadStream;
    mockInput.isTTY = true;
    mockInput.setRawMode = (_mode: boolean) => mockInput;
    const mockOutput = new PassThrough() as unknown as NodeJS.WriteStream;
    mockOutput.isTTY = true;
    const written: string[] = [];
    mockOutput.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };

    const resultPromise = confirm('Test?', { input: mockInput, output: mockOutput });
    await new Promise<void>((r) => setImmediate(r));
    mockInput.emit('data', Buffer.from('y'));
    await resultPromise;

    expect(written.join('')).toContain('[y/n]');
  });
});

describe('createConfirmer — non-TTY sequential questions', () => {
  it('answers two sequential questions from one piped multi-line input', async () => {
    const ask = createConfirmer({ input: streamFromString('y\nn\n'), output: nullSink() });
    expect(await ask('Q1?')).toBe(true);
    expect(await ask('Q2?')).toBe(false);
  });

  it('treats a missing second answer as false', async () => {
    const ask = createConfirmer({ input: streamFromString('y\n'), output: nullSink() });
    expect(await ask('Q1?')).toBe(true);
    expect(await ask('Q2?')).toBe(false);
  });

  it('accepts "yes" as well as "y"', async () => {
    const ask = createConfirmer({ input: streamFromString('yes\nyes\n'), output: nullSink() });
    expect(await ask('Q1?')).toBe(true);
    expect(await ask('Q2?')).toBe(true);
  });
});

describe('createConfirmer — TTY delegates to confirm()', () => {
  it('single "y" keypress resolves true', async () => {
    const mockInput = new PassThrough() as unknown as NodeJS.ReadStream;
    mockInput.isTTY = true;
    mockInput.setRawMode = (_mode: boolean) => mockInput;
    const mockOutput = new PassThrough() as unknown as NodeJS.WriteStream;
    mockOutput.isTTY = true;
    mockOutput.write = (_chunk: unknown) => true;

    const ask = createConfirmer({ input: mockInput, output: mockOutput });
    const resultPromise = ask('Test?');
    await new Promise<void>((r) => setImmediate(r));
    mockInput.emit('data', Buffer.from('y'));

    expect(await resultPromise).toBe(true);
  });
});
