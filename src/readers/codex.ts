import { existsSync, readFileSync } from 'node:fs';
import { extractCodexActivations } from '../extractors/activations';
import { extractCodexMentions } from '../extractors/mentions';
import { expandHome } from '../utils/expand-home';
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl';
import { isPathInProject } from '../utils/scope';
import type { UsageResult } from './claude';

export type CodexMode = 'activations' | 'mentions';

export interface CodexReaderOptions {
  since: Date;
  mode: CodexMode;
  root?: string;
  history?: string;
  scanAllFiles?: boolean;
  projectRoot?: string;
}

interface SessionMeta {
  cwd?: string;
  ids: string[];
}

// Reads cwd and session ids from the session_meta line near the top of a session file.
function readSessionMeta(file: string): SessionMeta {
  let head: string;
  try {
    head = readFileSync(file, 'utf8');
  } catch {
    return { ids: [] };
  }
  const lines = head.split('\n', 30);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as {
        type?: string;
        payload?: { cwd?: unknown; id?: unknown; session_id?: unknown };
      };
      if (e.type !== 'session_meta' || typeof e.payload !== 'object' || e.payload === null) {
        continue;
      }
      const { cwd, id, session_id } = e.payload;
      // Like the old cwd reader: a session_meta without a string cwd is skipped.
      if (typeof cwd !== 'string') continue;
      const ids = [session_id, id].filter((v): v is string => typeof v === 'string' && v !== '');
      return { cwd, ids };
    } catch {}
  }
  return { ids: [] };
}

// Ids of all sessions whose cwd is in the project. Walks every session file without
// the since filter: an old session can still have fresh history entries.
function collectProjectSessionIds(root: string, projectRoot: string): Set<string> {
  const ids = new Set<string>();
  for (const file of findJsonlFiles(root)) {
    const meta = readSessionMeta(file);
    if (!meta.cwd || !isPathInProject(meta.cwd, projectRoot)) continue;
    for (const id of meta.ids) ids.add(id);
  }
  return ids;
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
    if (options.projectRoot) {
      const sessionCwd = readSessionMeta(file).cwd;
      if (!sessionCwd || !isPathInProject(sessionCwd, options.projectRoot)) continue;
    }
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

  const projectIds = options.projectRoot
    ? collectProjectSessionIds(expandHome(options.root ?? '~/.codex/sessions'), options.projectRoot)
    : undefined;

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
    if (projectIds && !isProjectEntry(entry, projectIds)) continue;
    for (const skill of extractCodexMentions(entry)) {
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
    }
  }

  return { counts, filesRead: 1, linesRead };
}

function isProjectEntry(entry: unknown, projectIds: Set<string>): boolean {
  const sessionId = (entry as { session_id?: unknown }).session_id;
  return typeof sessionId === 'string' && projectIds.has(sessionId);
}
