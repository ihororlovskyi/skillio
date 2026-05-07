import { defineCommand } from 'citty';
import type { ClaudeMode } from '../readers/claude';
import { readClaudeUsage } from '../readers/claude';
import type { CodexMode } from '../readers/codex';
import { readCodexUsage } from '../readers/codex';
import { parsePeriod } from '../utils/period';

type Agent = 'claude' | 'codex';

export interface AuditArgs {
  agent?: string;
  period: string;
  since?: string;
  mode?: string;
  format: string;
  root?: string;
  'scan-all-files': boolean;
}

function parseAgents(agent: string | undefined): Agent[] {
  if (!agent) throw new Error('--agent is required. Use --agent claude, --agent codex, or both.');
  const normalized = agent
    .split(',')
    .map((a) => a.trim())
    .map((a): Agent => {
      if (a === 'codex') return 'codex';
      if (['claude', 'claude-code', 'claudecode'].includes(a)) return 'claude';
      throw new Error(`Unknown agent: "${a}". Use "claude" or "codex".`);
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
  const since = args.since
    ? new Date(`${args.since}T00:00:00`)
    : new Date(Date.now() - parsePeriod(args.period) * 24 * 60 * 60 * 1000);

  if (Number.isNaN(since.getTime())) {
    console.error(`Invalid --since value: ${args.since}`);
    process.exit(1);
  }

  const results: Array<{
    agent: Agent;
    mode: string;
    rows: ReturnType<typeof toRows>;
    stats: { filesRead: number; linesRead: number };
  }> = [];

  for (const agent of agents) {
    if (agent === 'claude') {
      const mode = (args.mode ?? 'attributed') as ClaudeMode;
      const result = readClaudeUsage({
        since,
        mode,
        root: args.root,
        scanAllFiles: args['scan-all-files'],
      });
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
        scanAllFiles: args['scan-all-files'],
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

  for (const { agent, mode, rows, stats } of results) {
    console.log(`\n${agent} skill usage since ${since.toISOString().slice(0, 10)} (${mode})`);
    console.log(`Files read: ${stats.filesRead}; JSONL lines read: ${stats.linesRead}`);
    if (rows.length === 0) {
      console.log('No skills found.');
    } else {
      const maxLen = Math.max(...rows.map((r) => String(r.count).length));
      for (const r of rows) console.log(`${String(r.count).padStart(maxLen)} ${r.skill}`);
    }
  }
}

export const auditCommand = defineCommand({
  meta: { description: 'Audit skill usage from agent session logs' },
  args: {
    agent: { type: 'string', alias: 'a', description: 'claude, codex, or comma-separated' },
    period: { type: 'string', alias: 'p', default: '7d', description: '7d, 2w, 1m, 1y' },
    since: { type: 'string', description: 'yyyy-mm-dd, overrides --period' },
    mode: { type: 'string', description: 'attributed | activations | mentions' },
    format: { type: 'string', default: 'text', description: 'text | json' },
    root: { type: 'string', description: 'Override agent sessions directory' },
    'scan-all-files': { type: 'boolean', default: false, description: 'Ignore file mtime' },
  },
  async run({ args }) {
    await runAudit(args as AuditArgs);
  },
});
