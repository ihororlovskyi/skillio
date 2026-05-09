import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface RmOptions {
  allowedRoots: string[];
}

export interface RmResult {
  removed: boolean;
  fileCount: number;
}

function isInside(target: string, root: string): boolean {
  const t = resolve(target);
  const r = resolve(root);
  return t === r || t.startsWith(`${r}/`);
}

function countFiles(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = lstatSync(path);
  if (stat.isFile()) return 1;
  if (!stat.isDirectory()) return 0;
  let n = 0;
  for (const entry of readdirSync(path)) {
    n += countFiles(join(path, entry));
  }
  return n;
}

export function rmSkillDir(path: string, opts: RmOptions): RmResult {
  const safe = opts.allowedRoots.some((root) => isInside(path, root));
  if (!safe) {
    throw new Error(`Refusing to delete: "${path}" is outside allowed roots`);
  }
  if (!existsSync(path)) return { removed: false, fileCount: 0 };
  const fileCount = countFiles(path);
  rmSync(path, { recursive: true, force: true });
  return { removed: true, fileCount };
}
