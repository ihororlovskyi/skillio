export type OutputMode = 'clear' | 'silent' | 'quiet';

export type ModeResult =
  | { kind: 'ok'; mode: OutputMode; rest: string[] }
  | { kind: 'error'; message: string };

const VALUES = new Map<string, OutputMode>([
  ['clear', 'clear'],
  ['c', 'clear'],
  ['silent', 'silent'],
  ['s', 'silent'],
  ['quiet', 'quiet'],
  ['q', 'quiet'],
]);

const CHOICES = 'clear (c), silent (s) or quiet (q)';

export function extractMode(argv: string[]): ModeResult {
  const rest: string[] = [];
  let chosen: OutputMode | null = null;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i] ?? '';
    let value: string | undefined;
    if (tok === '-m' || tok === '--mode') {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        return { kind: 'error', message: `${tok} needs a value: ${CHOICES}` };
      }
      i++;
    } else if (tok.startsWith('--mode=')) {
      value = tok.slice('--mode='.length);
    } else {
      rest.push(tok);
      continue;
    }
    const mode = VALUES.get(value);
    if (mode === undefined) {
      return { kind: 'error', message: `unknown mode "${value}", use ${CHOICES}` };
    }
    if (chosen !== null && chosen !== mode) {
      return { kind: 'error', message: `conflicting modes: ${chosen} and ${mode}` };
    }
    chosen = mode;
  }
  return { kind: 'ok', mode: chosen ?? 'clear', rest };
}
