#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { auditCommand } from './commands/audit';
import { listCommand } from './commands/list';
import { removeCommand } from './commands/remove';
import { summaryCommand } from './commands/summary';

const SUBCOMMANDS = new Set(['audit', 'summary', 'list', 'ls', 'remove', 'rm']);
const HELP_FLAGS = new Set(['--help', '-h', '--version', '-v']);
const firstArg = process.argv[2];

if (firstArg === undefined) {
  process.argv.splice(2, 0, 'summary');
} else if (!SUBCOMMANDS.has(firstArg) && !HELP_FLAGS.has(firstArg) && firstArg.startsWith('-')) {
  const hasAgent = process.argv
    .slice(2)
    .some((a) => a === '--agent' || a === '-a' || a.startsWith('--agent='));
  process.argv.splice(2, 0, hasAgent ? 'audit' : 'summary');
}

// Merge space-separated agent values into comma-separated so both
// `-a codex claude` and `-a codex,claude` work the same way.
const AGENT_FLAGS = new Set(['-a', '--agent']);
const VALID_AGENTS = new Set(['claude', 'codex', 'claude-code', 'claudecode']);
for (let i = 2; i < process.argv.length - 1; i++) {
  if (AGENT_FLAGS.has(process.argv[i])) {
    const values = [process.argv[i + 1]];
    let j = i + 2;
    while (j < process.argv.length && VALID_AGENTS.has(process.argv[j])) {
      values.push(process.argv[j]);
      j++;
    }
    if (values.length > 1) {
      process.argv.splice(i + 1, values.length, values.join(','));
    }
    break;
  }
}

const main = defineCommand({
  meta: {
    name: 'skillsee',
    version: '0.1.1',
    description: 'Audit and manage AI agent skills',
  },
  subCommands: {
    summary: summaryCommand,
    audit: auditCommand,
    list: listCommand,
    ls: listCommand,
    remove: removeCommand,
    rm: removeCommand,
  },
});

runMain(main);
