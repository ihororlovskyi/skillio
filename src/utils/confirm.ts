import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

export interface ConfirmOptions {
  input?: NodeJS.ReadableStream | Readable;
  output?: NodeJS.WritableStream | Writable;
}

export async function confirm(question: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;
  const rl = createInterface({
    input: input as NodeJS.ReadableStream,
    output: output as NodeJS.WritableStream,
  });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
