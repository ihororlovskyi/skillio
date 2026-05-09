import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const PKG = 'skillio';
const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;

export function getCachePath(): string {
  return join(homedir(), '.cache', 'skillio', 'version.json');
}

interface Cache {
  checkedAt: number;
  latest: string;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function readCache(path: string = getCachePath()): Cache | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Cache;
  } catch {
    return undefined;
  }
}

export function writeCache(cache: Cache, path: string = getCachePath()): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cache));
  } catch {
    // best-effort: ignore failures (read-only fs, etc.)
  }
}

function fetchLatest(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const req = get(
      `https://registry.npmjs.org/${PKG}/latest`,
      { timeout: FETCH_TIMEOUT_MS },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(undefined);
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body) as { version?: string };
            resolve(typeof data.version === 'string' ? data.version : undefined);
          } catch {
            resolve(undefined);
          }
        });
      },
    );
    req.on('error', () => resolve(undefined));
    req.on('timeout', () => {
      req.destroy();
      resolve(undefined);
    });
  });
}

export async function maybePrintUpdateNotice(currentVersion: string): Promise<void> {
  if (process.env.SKILLIO_NO_UPDATE_CHECK) return;

  const now = Date.now();
  const cache = readCache();
  let latest = cache?.latest;

  if (!cache || now - cache.checkedAt > TTL_MS) {
    const fetched = await fetchLatest();
    if (fetched) {
      latest = fetched;
      writeCache({ checkedAt: now, latest });
    }
  }

  if (latest && compareVersions(latest, currentVersion) > 0) {
    process.stderr.write(
      `\nUpdate available: ${currentVersion} → ${latest}\nRun: npm i -g skillio\n\n`,
    );
  }
}
