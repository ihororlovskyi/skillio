import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

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

export function removeSkillFromLock(path: string, skill: string): { removed: boolean } {
  if (!existsSync(path)) return { removed: false };
  const lock = readLock(path);
  if (!Object.hasOwn(lock.skills, skill)) return { removed: false };
  delete lock.skills[skill];
  writeLock(path, lock);
  return { removed: true };
}
