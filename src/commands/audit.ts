import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ClaudeMode } from '../readers/claude';
import { readClaudeUsage } from '../readers/claude';
import type { CodexMode } from '../readers/codex';
import { readCodexUsage } from '../readers/codex';
import { expandHome } from '../utils/expand-home';
import { parsePeriod } from '../utils/period';
import { detectScope, encodeClaudeProjectDir } from '../utils/scope';

type Agent = 'claude-code' | 'codex';

export interface AuditArgs {
  agent?: string;
  period: string;
  since?: string;
  mode?: string;
  format: string;
  root?: string;
  'scan-all-files': boolean;
  global: boolean;
}

function parseAgents(agent: string | undefined): Agent[] {
  if (!agent) return ['claude-code', 'codex'];
  const normalized = agent
    .split('\x1f')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a): Agent => {
      if (a === 'codex') return 'codex';
      if (['claude', 'claude-code', 'claudecode'].includes(a)) return 'claude-code';
      throw new Error(
        `Unknown agent: "${a}". Use "claude-code" or "codex" (space-separated for both: -a claude-code codex).`,
      );
    });
  return [...new Set(normalized)];
}

function toRows(counts: Map<string, number>): Array<{ skill: string; count: number }> {
  return [...counts.entries()]
    .sort(([sa, ca], [sb, cb]) => cb - ca || sa.localeCompare(sb))
    .map(([skill, count]) => ({ skill, count }));
}

export async function runAudit(args: AuditArgs): Promise<void> {
  const agents = parseAgents(args.agent);
  const allTime = !args.since && args.period === 'all';
  const since = args.since
    ? new Date(`${args.since}T00:00:00`)
    : args.period === 'all'
      ? new Date(0)
      : new Date(Date.now() - parsePeriod(args.period));
  const scanAllFiles = allTime || args['scan-all-files'];

  if (Number.isNaN(since.getTime())) {
    console.error(`Invalid --since value: ${args.since}`);
    process.exit(1);
  }

  const scope = detectScope({
    global: args.global,
    rootOverride: !!args.root,
    cwd: process.cwd(),
  });
  const claudeProjectsRoot = expandHome('~/.claude/projects');
  const claudeRoot =
    args.root ??
    (scope.projectRoot
      ? join(claudeProjectsRoot, encodeClaudeProjectDir(scope.projectRoot))
      : claudeProjectsRoot);
  const claudeRootMissing = !args.root && !!scope.projectRoot && !existsSync(claudeRoot);

  const results: Array<{
    agent: Agent;
    mode: string;
    rows: ReturnType<typeof toRows>;
    stats: { filesRead: number; linesRead: number };
  }> = [];

  for (const agent of agents) {
    if (agent === 'claude-code') {
      const mode = (args.mode ?? 'attributed') as ClaudeMode;
      const result = claudeRootMissing
        ? { counts: new Map<string, number>(), filesRead: 0, linesRead: 0 }
        : readClaudeUsage({ since, mode, root: claudeRoot, scanAllFiles });
      results.push({
        agent,
        mode,
        rows: toRows(result.counts),
        stats: { filesRead: result.filesRead, linesRead: result.linesRead },
      });
    } else {
      const mode = (args.mode ?? 'activations') as CodexMode;
      const result = readCodexUsage({
        since,
        mode,
        root: args.root,
        scanAllFiles,
        projectRoot: scope.projectRoot,
      });
      results.push({
        agent,
        mode,
        rows: toRows(result.counts),
        stats: { filesRead: result.filesRead, linesRead: result.linesRead },
      });
    }
  }

  if (args.format === 'json') {
    const output = results.map(({ agent, mode, rows }) => ({
      agent,
      mode,
      since: since.toISOString(),
      skills: rows,
    }));
    console.log(JSON.stringify(output.length === 1 ? output[0] : output, null, 2));
    return;
  }

  const sinceLabel = allTime ? 'all-time' : `since ${since.toISOString().slice(0, 10)}`;
  const scopeLabel = scope.global ? 'global' : (scope.projectRoot ?? 'global');
  console.log(`Scope: ${scopeLabel}${scope.global ? '' : '  (use -g for global)'}`);
  for (const { agent, mode, rows, stats } of results) {
    console.log(`\n${agent} skill usage ${sinceLabel} (${mode})`);
    console.log(`Files read: ${stats.filesRead}; JSONL lines read: ${stats.linesRead}`);
    if (rows.length === 0) {
      console.log('No skills found.');
    } else {
      const maxLen = Math.max(...rows.map((r) => String(r.count).length));
      for (const r of rows) console.log(`${String(r.count).padStart(maxLen)} ${r.skill}`);
    }
  }
}

export const auditArgs = {
  agent: {
    type: 'string',
    alias: 'a',
    description: 'claude-code, codex (default: both; pass space-separated for both)',
  },
  period: {
    type: 'string',
    alias: 'p',
    default: 'all',
    description: '30sec, 5min, 12h, 7d, 2w, 1m, 1y, all',
  },
  since: { type: 'string', description: 'yyyy-mm-dd, overrides --period' },
  mode: { type: 'string', description: 'attributed | activations | mentions' },
  format: { type: 'string', default: 'text', description: 'text | json' },
  root: { type: 'string', description: 'Override agent sessions directory; implies global' },
  'scan-all-files': { type: 'boolean', default: false, description: 'Ignore file mtime' },
  global: {
    type: 'boolean',
    alias: 'g',
    default: false,
    description: 'Force global scope (ignore current directory)',
  },
} as const;
