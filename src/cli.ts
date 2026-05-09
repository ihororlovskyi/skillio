#!/usr/bin/env node
import { createRequire } from 'node:module';
import { defineCommand, runMain } from 'citty';
import { type AuditArgs, auditArgs, runAudit } from './commands/audit';
import { costCommand } from './commands/cost';
import { listCommand } from './commands/list';
import { removeCommand } from './commands/remove';
import { maybePrintUpdateNotice } from './utils/update-check';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

if (process.argv[2] === 'audit') {
  process.argv.splice(2, 1);
}

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

process.argv = mergeAgentArgs(process.argv);

const SUBCOMMAND_NAMES = new Set(['list', 'ls', 'remove', 'rm', 'cost']);

const main = defineCommand({
  meta: {
    name: 'skillio',
    version,
    description: 'Audit and manage AI agent skills',
  },
  args: auditArgs,
  async run({ args }) {
    if (SUBCOMMAND_NAMES.has(process.argv[2] ?? '')) return;
    try {
      await runAudit(args as unknown as AuditArgs);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  },
  subCommands: {
    list: listCommand,
    ls: listCommand,
    remove: removeCommand,
    rm: removeCommand,
    cost: costCommand,
  },
});

(async () => {
  await maybePrintUpdateNotice(version);
  runMain(main);
})();
