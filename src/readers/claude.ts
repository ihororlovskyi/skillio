import { readFileSync } from 'node:fs';
import { extractClaudeActivations } from '../extractors/activations';
import { extractAttributed } from '../extractors/attributed';
import { extractClaudeMentions } from '../extractors/mentions';
import { expandHome } from '../utils/expand-home';
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl';

export type ClaudeMode = 'attributed' | 'activations' | 'mentions';

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

function extractSkills(entry: unknown, mode: ClaudeMode): string[] {
  if (mode === 'attributed') return extractAttributed(entry);
  if (mode === 'activations') return extractClaudeActivations(entry);
  return extractClaudeMentions(entry);
}

export function readClaudeUsage(options: ClaudeReaderOptions): UsageResult {
  const root = expandHome(options.root ?? '~/.claude/projects');
  const counts = new Map<string, number>();
  let filesRead = 0;
  let linesRead = 0;
  const since = options.scanAllFiles ? undefined : options.since;

  for (const file of findJsonlFiles(root, since)) {
    filesRead++;
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
      for (const skill of extractSkills(entry, options.mode)) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1);
      }
    }
  }

  return { counts, filesRead, linesRead };
}
