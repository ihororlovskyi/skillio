#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { auditCommand } from './commands/audit';
import { listCommand } from './commands/list';
import { removeCommand } from './commands/remove';

const SUBCOMMANDS = new Set(['audit', 'list', 'ls', 'remove', 'rm']);
const HELP_FLAGS = new Set(['--help', '-h', '--version', '-v']);
const firstArg = process.argv[2];

if (firstArg === undefined || (!SUBCOMMANDS.has(firstArg) && !HELP_FLAGS.has(firstArg))) {
  process.argv.splice(2, 0, 'audit');
}

const main = defineCommand({
  meta: {
    name: 'skvisor',
    version: '0.1.0',
    description: 'Audit and manage AI agent skills',
  },
  subCommands: {
    audit: auditCommand,
    list: listCommand,
    ls: listCommand,
    remove: removeCommand,
    rm: removeCommand,
  },
});

runMain(main);
