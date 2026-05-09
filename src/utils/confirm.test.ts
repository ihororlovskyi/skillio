import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { confirm } from './confirm';

function streamFromString(s: string): Readable {
  return Readable.from([s]);
}

function nullSink(): Writable {
  return new Writable({ write: (_chunk, _enc, cb) => cb() });
}

describe('confirm', () => {
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
