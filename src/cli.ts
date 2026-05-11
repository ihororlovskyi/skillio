#!/usr/bin/env node
import { createRequire } from 'node:module';
import { defineCommand, runMain } from 'citty';
import { costCommand } from './commands/cost';
import { listCommand } from './commands/list';
import { removeCommand } from './commands/remove';
import { summaryCommand } from './commands/summary';
import { usageCommand } from './commands/usage';
import { detectColorSupport, setColorEnabled } from './utils/ansi';
import { maybePrintUpdateNotice } from './utils/update-check';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

function mergeAgentArgs(argv: string[]): string[] {
  const out: string[] = [];
  const values: string[] = [];
  let slotIdx = -1;
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === undefined) {
      i++;
      continue;
    }
    if (tok === '-a' || tok === '--agent') {
      if (slotIdx === -1) slotIdx = out.length;
      let j = i + 1;
      while (j < argv.length) {
        const next = argv[j];
        if (next === undefined || next.startsWith('-')) break;
        values.push(next);
        j++;
      }
      i = j;
      continue;
    }
    out.push(tok);
    i++;
  }
  if (values.length > 0 && slotIdx !== -1) out.splice(slotIdx, 0, '--agent', values.join('\x1f'));
  return out;
}

const SUBCOMMAND_NAMES = new Set(['list', 'ls', 'remove', 'rm', 'cost', 'co', 'usage', 'us']);

function reorderRootFlagsToSubcommand(argv: string[]): string[] {
  const tail = argv.slice(2);
  const subIdx = tail.findIndex((t) => !!t && SUBCOMMAND_NAMES.has(t));
  if (subIdx <= 0) return argv;
  const before = tail.slice(0, subIdx);
  const sub = tail[subIdx];
  const after = tail.slice(subIdx + 1);
  if (!sub) return argv;
  return [argv[0] ?? '', argv[1] ?? '', sub, ...before, ...after];
}

process.argv = reorderRootFlagsToSubcommand(mergeAgentArgs(process.argv));

function printRootHelp(): void {
  const lines = [
    `Audit and manage AI agent skills (skillio v${version})`,
    '',
    'USAGE skillio [OPTIONS] [COMMAND]',
    '',
    'OPTIONS',
    '',
    '  -h, --help       Show this help and exit',
    '  -v, --version    Show version and exit',
    '  -g, --global     Use global scope (default: false)',
    '  -p, --period     Period for `usage`: 30sec, 5min, 12h, 7d, 2w, 1m, 1y, all (default: all)',
    '  -a, --agent      Agent for `usage`: claude-code, codex (default: both)',
    '',
    'COMMANDS',
    '',
    '  list, ls         List skills per source with totals and lock-vs-disk diff',
    '  remove, rm       Remove skills from lock and delete their on-disk dirs',
    '  cost, co         Show ambient ballast cost (per-skill frontmatter tokens) sorted desc',
    '  usage, us        Show skill usage × cost (consumption) with missed rows',
  ];
  console.log(lines.join('\n'));
}

function isRootHelp(argv: string[]): boolean {
  const args = argv.slice(2);
  const first = args[0];
  if (first && SUBCOMMAND_NAMES.has(first)) return false;
  return args.includes('--help') || args.includes('-h');
}

function firstPositional(argv: string[]): string | null {
  for (let i = 2; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok) continue;
    if (tok.startsWith('-')) {
      // -p and -a take a value; skip it so we don't confuse a flag value with a positional
      if (tok === '-p' || tok === '--period' || tok === '-a' || tok === '--agent') i++;
      continue;
    }
    return tok;
  }
  return null;
}

function hasSubcommand(argv: string[]): boolean {
  const tok = firstPositional(argv);
  return tok !== null && SUBCOMMAND_NAMES.has(tok);
}

function unknownCommand(argv: string[]): string | null {
  const tok = firstPositional(argv);
  if (!tok) return null;
  if (SUBCOMMAND_NAMES.has(tok)) return null;
  return tok;
}

function isRootVersion(argv: string[]): boolean {
  const args = argv.slice(2);
  const first = args[0];
  if (first && SUBCOMMAND_NAMES.has(first)) return false;
  return args.includes('--version') || args.includes('-v');
}

const main = defineCommand({
  meta: {
    name: 'skillio',
    version,
    description: 'Audit and manage AI agent skills',
  },
  args: summaryCommand.args,
  async run({ args }) {
    if (hasSubcommand(process.argv)) return;
    await summaryCommand.run?.({
      args,
      cmd: summaryCommand,
      rawArgs: process.argv.slice(2),
    } as never);
  },
  subCommands: {
    list: listCommand,
    ls: listCommand,
    remove: removeCommand,
    rm: removeCommand,
    cost: costCommand,
    co: costCommand,
    usage: usageCommand,
    us: usageCommand,
  },
});

(async () => {
  if (isRootHelp(process.argv)) {
    printRootHelp();
    return;
  }
  if (isRootVersion(process.argv)) {
    console.log(version);
    return;
  }
  const unknown = unknownCommand(process.argv);
  if (unknown) {
    console.error(`${unknown} - is unknowed, use skl -h for usage`);
    process.exit(1);
  }
  setColorEnabled(detectColorSupport());
  await maybePrintUpdateNotice(version);
  runMain(main);
})();
