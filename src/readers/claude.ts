import { readFileSync } from 'node:fs';
import { extractClaudeActivations } from '../extractors/activations';
import { extractAttributed } from '../extractors/attributed';
import { extractClaudeMentions } from '../extractors/mentions';
import { expandHome } from '../utils/expand-home';
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl';

export type ClaudeMode = 'attributed' | 'activations' | 'mentions' | 'merged';

export interface ClaudeReaderOptions {
  since: Date;
  mode: ClaudeMode;
  root?: string;
  scanAllFiles?: boolean;
}

export interface UsageResult {
  counts: Map<string, number>;
  filesRead: number;
  linesRead: number;
}

export function readClaudeUsage(options: ClaudeReaderOptions): UsageResult {
  const root = expandHome(options.root ?? '~/.claude/projects');
  const counts = new Map<string, number>();
  let filesRead = 0;
  let linesRead = 0;
  const since = options.scanAllFiles ? undefined : options.since;

  for (const file of findJsonlFiles(root, since)) {
    filesRead++;
    let prevSkill: string | null = null;
    const sessionAttr = new Map<string, number>();
    const sessionAct = new Map<string, number>();
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      linesRead++;
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isRecentEntry(entry, options.since)) continue;
      if (options.mode === 'attributed' || options.mode === 'merged') {
        const cur = extractAttributed(entry)[0];
        if (cur !== undefined) {
          if (cur !== prevSkill) {
            sessionAttr.set(cur, (sessionAttr.get(cur) ?? 0) + 1);
          }
          prevSkill = cur;
        }
      }
      if (options.mode === 'activations' || options.mode === 'merged') {
        for (const skill of extractClaudeActivations(entry)) {
          sessionAct.set(skill, (sessionAct.get(skill) ?? 0) + 1);
        }
      }
      if (options.mode === 'mentions') {
        for (const skill of extractClaudeMentions(entry)) {
          counts.set(skill, (counts.get(skill) ?? 0) + 1);
        }
      }
    }
    if (options.mode === 'attributed') {
      for (const [k, v] of sessionAttr) counts.set(k, (counts.get(k) ?? 0) + v);
    } else if (options.mode === 'activations') {
      for (const [k, v] of sessionAct) counts.set(k, (counts.get(k) ?? 0) + v);
    } else if (options.mode === 'merged') {
      const keys = new Set<string>([...sessionAttr.keys(), ...sessionAct.keys()]);
      for (const k of keys) {
        const merged = Math.max(sessionAttr.get(k) ?? 0, sessionAct.get(k) ?? 0);
        counts.set(k, (counts.get(k) ?? 0) + merged);
      }
    }
  }

  return { counts, filesRead, linesRead };
}
