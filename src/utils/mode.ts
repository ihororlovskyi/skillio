export type ModeResult =
  | { kind: 'ok'; silent: boolean; rest: string[] }
  | { kind: 'error'; message: string };

const SILENT = new Set(['silent', 's']);

export function extractMode(argv: string[]): ModeResult {
  const rest: string[] = [];
  let silent = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i] ?? '';
    let value: string | undefined;
    if (tok === '-m' || tok === '--mode') {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        return { kind: 'error', message: `${tok} needs a value: silent (s)` };
      }
      i++;
    } else if (tok.startsWith('--mode=')) {
      value = tok.slice('--mode='.length);
    } else {
      rest.push(tok);
      continue;
    }
    if (!SILENT.has(value)) {
      return { kind: 'error', message: `unknown mode "${value}", use silent (s)` };
    }
    silent = true;
  }
  return { kind: 'ok', silent, rest };
}
