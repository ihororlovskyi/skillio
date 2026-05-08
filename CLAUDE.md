# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

`skcl` is a TypeScript npm CLI + library for auditing AI agent skill usage (Claude Code and Codex). It parses session logs and manages a skills lock file.

## Commands

```sh
# Build (bun is not in PATH — use full path)
~/.bun/bin/bun run node_modules/.bin/bunup

# Lint / format
npm run lint            # biome check src/
npm run format          # biome format --write src/

# Tests
npm test                # unit tests (src/**/*.test.ts)
npm run test:e2e        # e2e tests — requires a fresh build first

# Run a single unit test file
npx vitest run src/extractors/attributed.test.ts

# CLI (after build)
node dist/cli.js --help
node dist/cli.js --agent claude-code --period 7d
node dist/cli.js --agent codex --mode activations
node dist/cli.js list
node dist/cli.js remove brainstorming --dry-run
node dist/cli.js remove brainstorming writing-plans   # multi-remove

# Full prepublish check (lint → unit → build → e2e)
npm run lint && npm test && npm run build && npm run test:e2e
```

## Architecture

### Package structure

Dual-output build via `bunup.config.ts` (two entries):
- `src/index.ts` → `dist/index.js` (ESM) + `dist/index.cjs` (CJS) + `.d.ts` types
- `src/cli.ts` → `dist/cli.js` (ESM only, no types)

**`src/extractors/`** — pure functions `(entry: unknown) => string[]`, no I/O:
- `attributed.ts` — reads `entry.attributionSkill`
- `activations.ts` — deep-walks for `{type:"tool_use", name:"Skill"}` (Claude) or `exec_command_end`/`<skill>` XML (Codex)
- `mentions.ts` — scans all strings for `foo/SKILL.md` paths or `superpowers:name` tokens

**`src/readers/`** — combine extractors with filesystem I/O:
- `claude.ts` — reads `~/.claude/projects/**/*.jsonl`, skips files older than `since` by mtime
- `codex.ts` — reads `~/.codex/sessions/**/*.jsonl` (activations) or `~/.codex/history.jsonl` (mentions)

**`src/commands/`** — citty command definitions: `audit.ts`, `list.ts`, `remove.ts`; `remove` accepts one or more space-separated skill names via `process.argv` parsing

**`src/lock/file.ts`** — read/write `skills-lock.json` (local) or `~/.agents/.skill-lock.json` (global); atomic writes via temp file; backups go to `.tmp/<filename>.bak` (`getBackupPath`, `backupLock` exports)

**`src/utils/`** — `period.ts` (period shorthands), `jsonl.ts` (line reader), `expand-home.ts`, `walk.ts`

**`test/e2e/`** — spawn `dist/cli.js` via `spawnSync`, fixtures in `test/fixtures/{claude,codex,lock}/`

### Lock file format

```json
{ "skills": { "skill-name": {} } }
```

`Object.keys(lock.skills)` gives installed skill names.

## Gotchas

- **bun path**: `npm run build` intentionally calls `~/.bun/bin/bun run node_modules/.bin/bunup`; keep that full path unless Bun is guaranteed to be in PATH.
- **citty default subcommand**: `skcl` without a subcommand invokes `audit`. Citty doesn't support this natively — `src/cli.ts` preprocesses `process.argv` and splices `'audit'` at index 2 when the first arg is not a known subcommand or help flag.
- **e2e tests require a fresh build**: `npm run test:e2e` spawns `dist/cli.js` — stale build = wrong behavior.
