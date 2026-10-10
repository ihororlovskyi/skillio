import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A missing directory or file means no sessions: an agent that never ran has no
// session dir, and sessions can be deleted mid-scan. Other errors propagate.
export function* findJsonlFiles(dir: string, since?: Date): Generator<string> {
  let items: Dirent[];
  try {
    items = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (isNotFound(e)) return;
    throw e;
  }
  for (const item of items) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      yield* findJsonlFiles(path, since);
    } else if (item.isFile() && item.name.endsWith('.jsonl')) {
      if (!since) {
        yield path;
        continue;
      }
      let mtime: Date;
      try {
        mtime = statSync(path).mtime;
      } catch (e) {
        if (isNotFound(e)) continue;
        throw e;
      }
      if (mtime >= since) yield path;
    }
  }
}

function isNotFound(e: unknown): boolean {
  return (e as NodeJS.ErrnoException).code === 'ENOENT';
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
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.timestamp === 'string') {
    const d = new Date(e.timestamp);
    return Number.isNaN(d.getTime()) || d >= since;
  }
  if (typeof e.ts === 'number') return new Date(e.ts * 1000) >= since;
  return false;
}
