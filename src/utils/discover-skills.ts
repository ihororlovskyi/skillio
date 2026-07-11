import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { readLock } from '../lock/file';
import { CHARS_PER_TOKEN, estimateTokens, extractFrontmatter } from './skill-files';

export type SkillSource = 'lock' | '.claude' | '.agents';

export interface SkillRecord {
  name: string;
  sources: SkillSource[];
  skillFile?: string;
  frontmatterTokens?: number;
  status: 'ok' | 'missing' | 'no-frontmatter';
}

export interface DiscoverInput {
  isGlobal: boolean;
  cwd: string;
  lockPath: string;
}

interface SkillRoots {
  claude?: string;
  agents?: string;
}

function resolveRoots(input: DiscoverInput): SkillRoots {
  if (input.isGlobal) {
    return {
      claude: join(homedir(), '.claude', 'skills'),
      agents: join(homedir(), '.agents', 'skills'),
    };
  }
  const repo = dirname(resolve(input.lockPath));
  return {
    claude: join(repo, '.claude', 'skills'),
    agents: join(repo, '.agents', 'skills'),
  };
}

function listSkillNames(root: string | undefined): string[] {
  if (!root || !existsSync(root)) return [];
  return readdirSync(root).filter((name) => {
    const entry = join(root, name);
    // A symlink entry is a skill regardless of whether its target resolves —
    // dangling symlinks must still be listed so ls/rm can see and clean them up.
    if (lstatSync(entry).isSymbolicLink()) return true;
    const skill = join(entry, 'SKILL.md');
    return existsSync(skill) && statSync(skill).isFile();
  });
}

function tokensFromFile(path: string): { tokens?: number; status: 'ok' | 'no-frontmatter' } {
  const content = readFileSync(path, 'utf8');
  const fm = extractFrontmatter(content);
  if (fm === undefined) return { status: 'no-frontmatter' };
  return { tokens: estimateTokens(fm), status: 'ok' };
}

export function discoverSkills(input: DiscoverInput): Map<string, SkillRecord> {
  const roots = resolveRoots(input);
  const lock = readLock(input.lockPath);
  const lockNames = Object.keys(lock.skills);
  const claudeNames = listSkillNames(roots.claude);
  const agentsNames = listSkillNames(roots.agents);

  const all = new Set<string>([...lockNames, ...claudeNames, ...agentsNames]);
  const out = new Map<string, SkillRecord>();

  for (const name of all) {
    const sources: SkillSource[] = [];
    if (lockNames.includes(name)) sources.push('lock');
    if (claudeNames.includes(name)) sources.push('.claude');
    if (agentsNames.includes(name)) sources.push('.agents');

    let skillFile: string | undefined;
    if (claudeNames.includes(name) && roots.claude) {
      const candidate = join(roots.claude, name, 'SKILL.md');
      if (existsSync(candidate)) skillFile = candidate;
    }
    if (!skillFile && agentsNames.includes(name) && roots.agents) {
      const candidate = join(roots.agents, name, 'SKILL.md');
      if (existsSync(candidate)) skillFile = candidate;
    }

    if (!skillFile) {
      out.set(name, { name, sources, status: 'missing' });
      continue;
    }
    const { tokens, status } = tokensFromFile(skillFile);
    out.set(name, { name, sources, skillFile, frontmatterTokens: tokens, status });
  }

  // expose CHARS_PER_TOKEN consumers via a re-export to avoid double-import elsewhere
  void CHARS_PER_TOKEN;
  return out;
}
