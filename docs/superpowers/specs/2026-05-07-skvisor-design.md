# skvisor — Design Spec

**Date:** 2026-05-07
**Status:** approved

## Overview

`skvisor` is a public npm CLI package for auditing and managing AI agent skills used by Claude Code and OpenAI Codex. It replaces the existing standalone ESM scripts in `scripts/` with a typed, tested, published CLI tool.

```sh
npx skvisor --agent claude --period 7d
pnpm dlx skvisor --agent codex --period 2w
```

## Goals

- Audit which skills agents actually used, from their session logs
- List and remove skills from a local or global lock file
- Work with `npx`, `pnpm dlx`, `npm i -g`, `pnpm add -g`
- Zero runtime dependencies (Node.js built-ins only)
- Fully typed TypeScript with generated `.d.ts`

## CLI Commands

Flat command structure — no sub-command groups.

```
skvisor [audit]              default command, same as skvisor audit
skvisor audit                audit skill usage from agent logs
skvisor list / ls            list skills from lock file
skvisor remove / rm <name>   remove a skill from lock file
```

### `audit` flags

| Flag | Short | Default | Description |
|---|---|---|---|
| `--agent` | `-a` | — | `claude`, `codex`, or both (repeat flag or comma-separated) |
| `--period` | `-p` | `7d` | `7d`, `2w`, `1m`, `1y` |
| `--since` | | — | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | | `attributed` (claude) / `activations` (codex) | `attributed \| activations \| mentions` |
| `--format` | | `text` | `text \| json` |
| `--root` | | agent default | override sessions directory |
| `--scan-all-files` | | false | ignore file mtime |

### `list` / `ls` flags

| Flag | Short | Description |
|---|---|---|
| `--global` | `-g` | use `~/.agents/.skill-lock.json` instead of `./skills-lock.json` |

### `remove` / `rm` flags

| Flag | Short | Description |
|---|---|---|
| `--global` | `-g` | remove from global lock |
| `--dry-run` | | print what would happen, no changes |

## Source Structure

```
src/
  cli.ts                   ← bin entry point, citty root command
  commands/
    audit.ts               ← citty command + audit orchestration
    list.ts                ← citty command + lock reader
    remove.ts              ← citty command + lock writer
  readers/
    claude.ts              ← iterates ~/.claude/projects/**/*.jsonl
    codex.ts               ← iterates ~/.codex/sessions/**/*.jsonl
  extractors/
    attributed.ts          ← entry → string[] (attributionSkill field)
    activations.ts         ← entry → string[] (Skill tool_use / exec_command)
    mentions.ts            ← entry → string[] (path/SKILL.md, superpowers:name)
  lock/
    file.ts                ← read/write/remove from skills-lock.json (atomic write)
  utils/
    period.ts              ← "7d" → number of days
    jsonl.ts               ← async generator over .jsonl files filtered by mtime
    expand-home.ts         ← "~/.foo" → absolute path
  index.ts                 ← public API re-exports (types + extractors)
```

Each extractor is a pure function `(entry: unknown) => string[]` — no I/O, fully unit-testable.

## Toolchain

| Concern | Tool |
|---|---|
| Runtime (dev) | Bun |
| Build | Bunup → `dist/` (ESM + CJS + `.d.ts`) |
| Lint + format | Biome |
| Tests | Vitest |
| Versioning | Changesets |
| Arg parsing | citty |

### Key `package.json` fields

```json
{
  "name": "skvisor",
  "bin": { "skvisor": "./dist/cli.js" },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" }
}
```

### Dev scripts

```sh
bun run build      # bunup
bun run lint       # biome check src/
bun run format     # biome format --write src/
bun run test       # vitest run (unit)
bun run test:e2e   # vitest run test/e2e (requires dist/)
bun run release    # changeset publish
```

`prepublishOnly`: `biome check && bun test && bunup && bun run test:e2e`

## Testing Strategy

### Unit tests (`src/**/*.test.ts`)

Pure function tests, no filesystem:

- `extractors/attributed.test.ts` — various entry shapes → expected skill names
- `extractors/activations.test.ts` — claude tool_use nodes, codex exec_command entries
- `extractors/mentions.test.ts` — path patterns, superpowers tokens
- `utils/period.test.ts` — period string parsing
- `lock/file.test.ts` — JSON read/write using temp files

### e2e tests (`test/e2e/`)

Spawn `dist/cli.js` as a child process, assert stdout and exit code:

```
test/
  fixtures/
    claude/sample.jsonl        ← entries covering all 3 modes
    codex/sample.jsonl
    lock/skills-lock.json
  e2e/
    audit-claude.test.ts
    audit-codex.test.ts
    list.test.ts
    remove.test.ts
```

CI order: `lint → bun test → bun run build → bun run test:e2e`

## Publishing

- Scope: public (`npm publish --access public`)
- Registry: npmjs.com
- Versioning: Changesets — `bun changeset` → `bun changeset version` → `bun changeset publish`
- `.npmignore` / `files` field: only `dist/` + `README.md` + `LICENSE` ship to registry

## What ships vs what stays

| Path | Ships to npm | Notes |
|---|---|---|
| `dist/` | ✅ | compiled output |
| `src/` | ❌ | TypeScript source |
| `scripts/` | ❌ | legacy bash/mjs scripts |
| `test/` | ❌ | fixtures and e2e |
| `docs/` | ❌ | internal specs |
| `README.md` | ✅ | |

## Migration from `scripts/`

The existing `scripts/*.mjs` files remain untouched. `package.json` scripts (`skills:used`, `skills:list`, etc.) continue to work. The `src/` TypeScript rewrite lives alongside them until `skvisor` is published and stable, at which point the `scripts/` aliases can point to `skvisor` or be removed.
