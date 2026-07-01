import { emitKeypressEvents } from 'node:readline';

export interface ConfirmOptions {
  input?: NodeJS.ReadStream | NodeJS.ReadableStream;
  output?: NodeJS.WriteStream | NodeJS.WritableStream;
}

export async function confirm(question: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const input = (opts.input ?? process.stdin) as NodeJS.ReadStream;
  const output = (opts.output ?? process.stdout) as NodeJS.WriteStream;

  if (!input.isTTY || !output.isTTY) {
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input, output });
    try {
      const answer = (await rl.question(`${question} [y/n] `)).trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      rl.close();
    }
  }

  output.write(`${question} [y/n] `);
  emitKeypressEvents(input);
  if (input.setRawMode) input.setRawMode(true);
  input.resume();

  return new Promise<boolean>((resolve) => {
    const onKey = (str: string, key: { name?: string; ctrl?: boolean }) => {
      const lower = (str ?? '').toLowerCase();
      if (key.ctrl && key.name === 'c') {
        cleanup();
        output.write('\n');
        resolve(false);
        return;
      }
      if (lower === 'y') {
        cleanup();
        output.write('y\n');
        resolve(true);
        return;
      }
      if (lower === 'n' || key.name === 'return' || key.name === 'escape' || lower === 'q') {
        cleanup();
        output.write(`${lower || 'n'}\n`);
        resolve(false);
        return;
      }
    };
    function onSigterm() {
      cleanup();
      output.write('\n');
      resolve(false);
    }
    function cleanup() {
      input.removeListener('keypress', onKey);
      process.removeListener('SIGTERM', onSigterm);
      if (input.setRawMode) input.setRawMode(false);
      input.pause();
    }
    process.once('SIGTERM', onSigterm);
    input.on('keypress', onKey);
  });
}

export function createConfirmer(opts: ConfirmOptions = {}): (question: string) => Promise<boolean> {
  const input = (opts.input ?? process.stdin) as NodeJS.ReadStream;
  const output = (opts.output ?? process.stdout) as NodeJS.WriteStream;

  if (input.isTTY && output.isTTY) {
    return (question: string) => confirm(question, { input, output });
  }

  let queue: string[] | undefined;
  return async (question: string) => {
    if (queue === undefined) {
      let raw = '';
      for await (const chunk of input) raw += chunk;
      queue = raw.split('\n');
    }
    output.write(`${question} [y/n] `);
    const line = (queue.shift() ?? '').trim().toLowerCase();
    return line === 'y' || line === 'yes';
  };
}
