import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const CHARS_PER_TOKEN = 4;

export function getSkillPathCandidates(
  name: string,
  lockPath: string,
  isGlobal: boolean,
): string[] {
  if (isGlobal) {
    return [
      join(homedir(), '.claude', 'skills', name, 'SKILL.md'),
      join(homedir(), '.agents', 'skills', name, 'SKILL.md'),
    ];
  }
  return [join(dirname(resolve(lockPath)), '.claude', 'skills', name, 'SKILL.md')];
}

export function findSkillFile(
  name: string,
  lockPath: string,
  isGlobal: boolean,
): string | undefined {
  for (const p of getSkillPathCandidates(name, lockPath, isGlobal)) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function extractFrontmatter(content: string): string | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match?.[1];
}

export function estimateTokens(text: string): number {
  return Math.round(text.length / CHARS_PER_TOKEN);
}

export function countFrontmatterTokens(filePath: string): number | undefined {
  const content = readFileSync(filePath, 'utf8');
  const fm = extractFrontmatter(content);
  if (fm === undefined) return undefined;
  return estimateTokens(fm);
}
