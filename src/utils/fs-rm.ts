import { lstatSync, readdirSync, rmSync, type Stats } from 'node:fs';
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

// existsSync follows symlinks, so it reports false for dangling links; lstat sees the link itself
export function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function countFiles(path: string): number {
  const stat = lstatOrNull(path);
  if (!stat) return 0;
  if (stat.isFile()) return 1;
  if (!stat.isDirectory()) return 0;
  let n = 0;
  for (const entry of readdirSync(path)) {
    n += countFiles(join(path, entry));
  }
  return n;
}

export function countFoldersAndFiles(dir: string): { folders: number; files: number } {
  let folders = 0;
  let files = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      folders++;
      const nested = countFoldersAndFiles(join(dir, entry.name));
      folders += nested.folders;
      files += nested.files;
    } else {
      files++;
    }
  }
  return { folders, files };
}

export function rmSkillDir(path: string, opts: RmOptions): RmResult {
  const safe = opts.allowedRoots.some((root) => isInside(path, root));
  if (!safe) {
    throw new Error(`Refusing to delete: "${path}" is outside allowed roots`);
  }
  if (!lstatOrNull(path)) return { removed: false, fileCount: 0 };
  const fileCount = countFiles(path);
  rmSync(path, { recursive: true, force: true });
  return { removed: true, fileCount };
}
