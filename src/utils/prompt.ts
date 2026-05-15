import { emitKeypressEvents } from 'node:readline';
import { cyan } from './ansi';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectParams {
  title: string;
  options: SelectOption[];
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

export async function select(params: SelectParams): Promise<string | null> {
  const input = params.input ?? process.stdin;
  const output = params.output ?? process.stdout;
  if (!input.isTTY || !output.isTTY) return null;

  let cursor = 0;
  const total = params.options.length;

  function render(): void {
    output.write(`${params.title}\n`);
    for (let i = 0; i < total; i++) {
      const opt = params.options[i];
      if (!opt) continue;
      const marker = i === cursor ? cyan('>') : ' ';
      output.write(`${marker} ${opt.label}\n`);
    }
  }

  function clear(): void {
    output.write(`\x1b[${total + 1}A\x1b[J`);
  }

  emitKeypressEvents(input);
  if (input.setRawMode) input.setRawMode(true);
  input.resume();
  render();

  return await new Promise<string | null>((resolve) => {
    const onKey = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'escape' || key.name === 'q') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'up' && cursor > 0) {
        cursor--;
        clear();
        render();
        return;
      }
      if (key.name === 'down' && cursor < total - 1) {
        cursor++;
        clear();
        render();
        return;
      }
      if (key.name === 'return') {
        cleanup();
        const chosen = params.options[cursor]?.value ?? null;
        resolve(chosen);
        return;
      }
    };
    function onSigterm(): void {
      cleanup();
      resolve(null);
    }
    function cleanup(): void {
      input.removeListener('keypress', onKey);
      process.removeListener('SIGTERM', onSigterm);
      if (input.setRawMode) input.setRawMode(false);
      input.pause();
    }
    process.once('SIGTERM', onSigterm);
    input.on('keypress', onKey);
  });
}

export async function multiSelect(params: SelectParams): Promise<string[] | null> {
  const input = params.input ?? process.stdin;
  const output = params.output ?? process.stdout;
  if (!input.isTTY || !output.isTTY) return null;

  let cursor = 0;
  const total = params.options.length;
  const selected = new Set<number>();

  function render(): void {
    output.write(`${params.title}\n`);
    for (let i = 0; i < total; i++) {
      const opt = params.options[i];
      if (!opt) continue;
      const cursorMark = i === cursor ? cyan('>') : ' ';
      const checkbox = selected.has(i) ? '[x]' : '[ ]';
      output.write(`${cursorMark} ${checkbox} ${opt.label}\n`);
    }
  }

  function clear(): void {
    output.write(`\x1b[${total + 1}A\x1b[J`);
  }

  emitKeypressEvents(input);
  if (input.setRawMode) input.setRawMode(true);
  input.resume();
  render();

  return await new Promise<string[] | null>((resolve) => {
    const onKey = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'escape' || key.name === 'q') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'up' && cursor > 0) {
        cursor--;
        clear();
        render();
        return;
      }
      if (key.name === 'down' && cursor < total - 1) {
        cursor++;
        clear();
        render();
        return;
      }
      if (key.name === 'space') {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        clear();
        render();
        return;
      }
      if (key.name === 'return') {
        cleanup();
        const values: string[] = [];
        for (let i = 0; i < total; i++) {
          if (selected.has(i)) {
            const v = params.options[i]?.value;
            if (v !== undefined) values.push(v);
          }
        }
        resolve(values);
        return;
      }
    };
    function onSigterm(): void {
      cleanup();
      resolve(null);
    }
    function cleanup(): void {
      input.removeListener('keypress', onKey);
      process.removeListener('SIGTERM', onSigterm);
      if (input.setRawMode) input.setRawMode(false);
      input.pause();
    }
    process.once('SIGTERM', onSigterm);
    input.on('keypress', onKey);
  });
}
