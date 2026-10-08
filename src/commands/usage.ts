import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineCommand } from 'citty';
import { getLockPath } from '../lock/file';
import { type ClaudeMode, readClaudeUsage } from '../readers/claude';
import { type CodexMode, readCodexUsage } from '../readers/codex';
import { cyan, red } from '../utils/ansi';
import { discoverSkills } from '../utils/discover-skills';
import { expandHome } from '../utils/expand-home';
import { parsePeriod } from '../utils/period';
import { detectScope, encodeClaudeProjectDir, scopeHeader } from '../utils/scope';

type Agent = 'claude-code' | 'codex';

export interface UsageArgs {
  agent?: string;
  period: string;
  since?: string;
  mode?: string;
  format: string;
  root?: string;
  'scan-all-files': boolean;
  global: boolean;
}

export interface UsageRowInput {
  count: number;
  name: string;
  countWidth: number;
  installed?: boolean;
}

function pad(n: number | string, width: number): string {
  return String(n).padStart(width);
}

export function formatUsageRow(row: UsageRowInput): string {
  const suffix = row.installed === false ? ` ${red('(missing)')}` : '';
  return `${pad(row.count, row.countWidth)} ${cyan(row.name)}${suffix}`;
}

function parseAgents(agent: string | undefined): Agent[] {
  if (!agent) return ['claude-code', 'codex'];
  const out = agent
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
  return [...new Set(out)];
}

const MODES = ['merged', 'attributed', 'activations', 'mentions'];
const FORMATS = ['text', 'json'];

function validateChoice(kind: string, value: string | undefined, allowed: string[]): void {
  if (value === undefined || allowed.includes(value)) return;
  const list = allowed.map((v) => `"${v}"`);
  const hint =
    list.length === 2 ? list.join(' or ') : `${list.slice(0, -1).join(', ')} or ${list.at(-1)}`;
  throw new Error(`Unknown ${kind}: "${value}". Use ${hint}.`);
}

export const usageArgs = {
  agent: {
    type: 'string',
    alias: 'a',
    description: 'claude-code, codex (default: both)',
  },
  period: {
    type: 'string',
    alias: 'p',
    default: 'all',
    description: '60s, 30m, 24h, 30d, 2w, 6mo, all',
  },
  since: { type: 'string', description: 'yyyy-mm-dd, overrides --period' },
  mode: {
    type: 'string',
    description: 'merged (default for claude-code) | attributed | activations | mentions',
  },
  format: { type: 'string', default: 'text', description: 'text | json' },
  root: { type: 'string', description: 'Override agent sessions directory; implies global' },
  'scan-all-files': { type: 'boolean', default: false, description: 'Ignore file mtime' },
  global: {
    type: 'boolean',
    alias: 'g',
    default: false,
    description: 'Force global scope',
  },
} as const;

export async function runUsage(args: UsageArgs): Promise<void> {
  validateChoice('mode', args.mode, MODES);
  validateChoice('format', args.format, FORMATS);
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

  const lockPath = getLockPath(args.global);
  const skillUniverse = discoverSkills({
    isGlobal: args.global,
    cwd: process.cwd(),
    lockPath,
  });

  interface AgentResult {
    agent: Agent;
    mode: string;
    rows: Array<{ name: string; count: number; tokens?: number; installed: boolean }>;
    stats: { filesRead: number; linesRead: number };
  }

  const results: AgentResult[] = [];

  for (const agent of agents) {
    let counts: Map<string, number>;
    let stats: { filesRead: number; linesRead: number };
    let mode: string;
    if (agent === 'claude-code') {
      mode = (args.mode ?? 'merged') as ClaudeMode;
      const result = claudeRootMissing
        ? { counts: new Map<string, number>(), filesRead: 0, linesRead: 0 }
        : readClaudeUsage({ since, mode: mode as ClaudeMode, root: claudeRoot, scanAllFiles });
      counts = result.counts;
      stats = { filesRead: result.filesRead, linesRead: result.linesRead };
    } else {
      mode = (args.mode ?? 'activations') as CodexMode;
      const result = readCodexUsage({
        since,
        mode: mode as CodexMode,
        root: args.root,
        scanAllFiles,
        projectRoot: scope.projectRoot,
      });
      counts = result.counts;
      stats = { filesRead: result.filesRead, linesRead: result.linesRead };
    }

    const universeNames = new Set([...skillUniverse.keys(), ...counts.keys()]);
    const allRows = [...universeNames].map((name) => {
      const rec = skillUniverse.get(name);
      return {
        name,
        count: counts.get(name) ?? 0,
        tokens: rec?.disableModelInvocation ? undefined : rec?.frontmatterTokens,
        installed: rec !== undefined && rec.status !== 'missing',
      };
    });
    const rows = allRows.filter((r) => r.count > 0);

    rows.sort((a, b) => {
      if (a.installed !== b.installed) return a.installed ? -1 : 1;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    results.push({ agent, mode, rows, stats });
  }

  if (args.format === 'json') {
    const output = results.map(({ agent, mode, rows }) => ({
      agent,
      mode,
      since: since.toISOString(),
      skills: rows.map((r) => ({
        skill: r.name,
        count: r.count,
        tokensPerSkill: r.tokens ?? null,
        consumption: (r.tokens ?? 0) * r.count,
        installed: r.installed,
      })),
    }));
    console.log(JSON.stringify(output.length === 1 ? output[0] : output, null, 2));
    return;
  }

  const periodLabel = args.since ? `since ${args.since}` : (args.period ?? 'all');
  console.log(scopeHeader(scope.global));

  const distinct = new Set<string>();
  let grandActivations = 0;

  for (const { agent, rows } of results) {
    const activations = rows.reduce((acc, r) => acc + r.count, 0);
    console.log(
      `${agent} ${rows.length} skill${rows.length === 1 ? '' : 's'} ${activations} time${activations === 1 ? '' : 's'} by ${periodLabel}`,
    );
    if (rows.length === 0) continue;
    const countWidth = Math.max(...rows.map((r) => String(r.count).length));
    for (const r of rows) {
      console.log(
        formatUsageRow({ count: r.count, name: r.name, countWidth, installed: r.installed }),
      );
      distinct.add(r.name);
    }
    grandActivations += activations;
  }

  console.log(
    `Total: ${distinct.size} skill${distinct.size === 1 ? '' : 's'} usage ${grandActivations} time${grandActivations === 1 ? '' : 's'}`,
  );
}

export const usageCommand = defineCommand({
  meta: { description: 'Show skill usage x cost (consumption) with missed rows' },
  args: usageArgs,
  async run({ args }) {
    try {
      await runUsage(args as unknown as UsageArgs);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  },
});
