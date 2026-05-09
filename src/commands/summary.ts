import { defineCommand } from 'citty';
import { readClaudeUsage } from '../readers/claude';
import { readCodexUsage } from '../readers/codex';
import { parsePeriod } from '../utils/period';

export const summaryCommand = defineCommand({
  meta: { description: 'Show session counts for all agents' },
  args: {
    period: {
      type: 'string',
      alias: 'p',
      default: '7d',
      description: '30sec, 5min, 12h, 7d, 2w, 1m, 1y',
    },
    since: { type: 'string', description: 'yyyy-mm-dd, overrides --period' },
    root: { type: 'string', description: 'Override agent sessions directory' },
    'scan-all-files': { type: 'boolean', default: false, description: 'Ignore file mtime' },
  },
  async run({ args }) {
    const since = args.since
      ? new Date(`${args.since}T00:00:00`)
      : new Date(Date.now() - parsePeriod(args.period));

    if (Number.isNaN(since.getTime())) {
      console.error(`Invalid --since value: ${args.since}`);
      process.exit(1);
    }

    const claude = readClaudeUsage({
      since,
      mode: 'attributed',
      root: args.root,
      scanAllFiles: args['scan-all-files'],
    });

    const codex = readCodexUsage({
      since,
      mode: 'activations',
      root: args.root,
      scanAllFiles: args['scan-all-files'],
    });

    const label = args.since ? `since ${args.since}` : `last ${args.period}`;

    const nameWidth = Math.max('claude'.length, 'codex'.length);
    const countWidth = Math.max(String(claude.filesRead).length, String(codex.filesRead).length);

    console.log(`Agent sessions (${label}):`);
    console.log(
      `  ${'claude'.padEnd(nameWidth)}  ${String(claude.filesRead).padStart(countWidth)} sessions`,
    );
    console.log(
      `  ${'codex'.padEnd(nameWidth)}   ${String(codex.filesRead).padStart(countWidth)} sessions`,
    );
  },
});
