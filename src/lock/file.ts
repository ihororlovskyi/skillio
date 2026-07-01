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

function serialize(lock: LockFile): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function writeLock(path: string, lock: LockFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${Date.now()}.skill-lock.json`);
  writeFileSync(tmp, serialize(lock));
  renameSync(tmp, path);
}

export function countLockLinesToRemove(path: string, names: string[]): number {
  if (!existsSync(path)) return 0;
  const lock = readLock(path);
  const before = serialize(lock);
  const after: LockFile = { skills: { ...lock.skills } };
  for (const name of names) delete after.skills[name];
  return before.split('\n').length - serialize(after).split('\n').length;
}

export function removeSkillFromLock(path: string, skill: string): { removed: boolean } {
  if (!existsSync(path)) return { removed: false };
  const lock = readLock(path);
  if (!Object.hasOwn(lock.skills, skill)) return { removed: false };
  delete lock.skills[skill];
  writeLock(path, lock);
  return { removed: true };
}
