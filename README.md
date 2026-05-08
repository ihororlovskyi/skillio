# sklio

[![npm version](https://img.shields.io/npm/v/sklio)](https://www.npmjs.com/package/sklio)
[![CI](https://github.com/ihororlovskyi/skls/actions/workflows/ci.yml/badge.svg)](https://github.com/ihororlovskyi/skls/actions/workflows/ci.yml)

Audit and manage AI agent skills for Claude Code and OpenAI Codex.

## Installation

```sh
# one-off (no install needed)
npx sklio audit --agent claude --period 7d
pnpm dlx sklio audit --agent codex --period 2w

# global install
npm install -g sklio
pnpm add -g sklio
```

## Usage

```sh
sklio --agent claude --period 7d         # audit last 7 days (default subcommand)
sklio audit --agent claude --period 7d   # audit last 7 days (attributed mode)
sklio audit --agent codex --mode activations  # codex activations
sklio audit -a claude codex --period 2w  # both agents, space-separated
sklio audit -a claude,codex --period 2w  # both agents, comma-separated
sklio list                                # list skills in local skills-lock.json
sklio list --global                       # list from ~/.agents/.skill-lock.json
sklio remove brainstorming               # remove skill from lock
sklio remove brainstorming writing-plans  # remove multiple skills
sklio remove --dry-run brainstorming     # preview removal
```

## What it does

- **Audit skill usage** — parse agent session logs and count which skills were invoked, when, and how often
- **Manage a skills lock** — list and remove skills from a local or global lock file

## Options

### `sklio` / `sklio audit`

Audits skill usage from agent session logs. `audit` is the default subcommand when the first argument is an audit flag.

```sh
sklio --agent claude --period 7d
sklio audit --agent codex --mode activations
```

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | required | `claude-code`/`claude`, `codex`, comma- or space-separated |
| `-p, --period` | `7d` | `7d`, `2w`, `1m`, `1y` |
| `--since` | — | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | `attributed` | `attributed` \| `activations` \| `mentions` |
| `--format` | `text` | `text` \| `json` |
| `--root` | — | Override agent sessions directory |
| `--scan-all-files` | — | Ignore file mtime, read everything |

### Modes

- **`attributed`** — entries with an `attributionSkill` field set by Claude Code. This is the default and most reliable Claude mode.
- **`activations`** — explicit `Skill` tool invocations found anywhere in the entry tree (Claude) or `exec_command_end` events / `<skill>` XML (Codex). This is the default and most reliable Codex mode.
- **`mentions`** — skill paths (`foo/SKILL.md`) or `superpowers:name` strings found in any string value. This is a broad search mode and can include examples from prompts, specs, or documentation.

### `sklio list` / `ls`

```sh
sklio list            # local skills-lock.json
sklio list --global   # ~/.agents/.skill-lock.json
```

### `sklio remove` / `rm`

```sh
sklio remove <skill-name>
sklio remove <skill-one> <skill-two>
sklio remove --global <skill-name>
sklio remove --dry-run <skill-name>
```

## Requirements

- Node.js ≥ 20
