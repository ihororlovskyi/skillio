import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

export interface LockFile {
  skills: Record<string, unknown>;
}

export function getLockPath(global: boolean): string {
  return global ? join(homedir(), '.agents', '.skill-lock.json') : 'skills-lock.json';
}

export function readLock(path: string): LockFile {
  if (!existsSync(path)) return { skills: {} };
  return JSON.parse(readFileSync(path, 'utf8')) as LockFile;
}

export function writeLock(path: string, lock: LockFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${Date.now()}.skill-lock.json`);
  writeFileSync(tmp, `${JSON.stringify(lock, null, 2)}\n`);
  renameSync(tmp, path);
}

export function getBackupPath(path: string): string {
  return join(dirname(path), '.tmp', `${basename(path)}.bak`);
}

export function backupLock(path: string): string {
  const backupPath = getBackupPath(path);
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(path, backupPath);
  return backupPath;
}

export function removeSkillFromLock(
  path: string,
  skill: string,
  { skipBackup = false }: { skipBackup?: boolean } = {},
): { removed: boolean; backupPath?: string } {
  if (!existsSync(path)) return { removed: false };
  const lock = readLock(path);
  if (!Object.hasOwn(lock.skills, skill)) return { removed: false };
  const backupPath = skipBackup ? undefined : backupLock(path);
  delete lock.skills[skill];
  writeLock(path, lock);
  return { removed: true, backupPath };
}
