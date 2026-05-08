import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function* findJsonlFiles(dir: string, since?: Date): Generator<string> {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      yield* findJsonlFiles(path, since);
    } else if (item.isFile() && item.name.endsWith('.jsonl')) {
      if (!since || statSync(path).mtime >= since) yield path;
    }
  }
}

export function readJsonlLines(file: string): unknown[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
}

export function isRecentEntry(entry: unknown, since: Date): boolean {
  if (typeof entry !== 'object' || entry === null) return true;
  const e = entry as Record<string, unknown>;
  if (typeof e.timestamp === 'string') {
    const d = new Date(e.timestamp);
    return Number.isNaN(d.getTime()) || d >= since;
  }
  if (typeof e.ts === 'number') return new Date(e.ts * 1000) >= since;
  return true;
}
