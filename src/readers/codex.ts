import { existsSync, readFileSync } from 'node:fs';
import { extractCodexActivations } from '../extractors/activations';
import { extractCodexMentions } from '../extractors/mentions';
import { expandHome } from '../utils/expand-home';
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl';
import type { UsageResult } from './claude';

export type CodexMode = 'activations' | 'mentions';

export interface CodexReaderOptions {
  since: Date;
  mode: CodexMode;
  root?: string;
  history?: string;
  scanAllFiles?: boolean;
}

export function readCodexUsage(options: CodexReaderOptions): UsageResult {
  return options.mode === 'mentions' ? readCodexMentions(options) : readCodexActivations(options);
}

function readCodexActivations(options: CodexReaderOptions): UsageResult {
  const root = expandHome(options.root ?? '~/.codex/sessions');
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
      for (const skill of extractCodexActivations(entry)) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1);
      }
    }
  }

  return { counts, filesRead, linesRead };
}

function readCodexMentions(options: CodexReaderOptions): UsageResult {
  const historyPath = expandHome(options.history ?? '~/.codex/history.jsonl');
  const counts = new Map<string, number>();
  let linesRead = 0;

  if (!existsSync(historyPath)) return { counts, filesRead: 0, linesRead: 0 };

  for (const line of readFileSync(historyPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    linesRead++;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecentEntry(entry, options.since)) continue;
    for (const skill of extractCodexMentions(entry)) {
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
    }
  }

  return { counts, filesRead: 1, linesRead };
}
