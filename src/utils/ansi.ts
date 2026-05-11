let enabled = false;

export function setColorEnabled(value: boolean): void {
  enabled = value;
}

export function detectColorSupport(): boolean {
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY);
}

export function green(s: string): string {
  return enabled ? `\x1b[32m${s}\x1b[0m` : s;
}

export function yellow(s: string): string {
  return enabled ? `\x1b[33m${s}\x1b[0m` : s;
}

export function red(s: string): string {
  return enabled ? `\x1b[31m${s}\x1b[0m` : s;
}
