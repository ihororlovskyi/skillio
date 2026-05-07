# skillsee

[![npm version](https://img.shields.io/npm/v/skillsee)](https://www.npmjs.com/package/skillsee)
[![CI](https://github.com/ihororlovskyi/skillsee/actions/workflows/ci.yml/badge.svg)](https://github.com/ihororlovskyi/skillsee/actions/workflows/ci.yml)

Audit and manage AI agent skills for Claude Code and OpenAI Codex.

## Installation

```sh
# one-off (no install needed)
npx skillsee audit --agent claude --period 7d
pnpm dlx skillsee audit --agent codex --period 2w

# global install
npm install -g skillsee
pnpm add -g skillsee
```

## Usage

```sh
skillsee                                     # session counts for both agents (last 7d)
skillsee audit --agent claude --period 7d   # audit last 7 days (attributed mode)
skillsee audit --agent codex --mode activations  # codex activations
skillsee audit -a claude codex --period 2w  # both agents, space-separated
skillsee audit -a claude,codex --period 2w  # both agents, comma-separated
skillsee list                                # list skills in local skills-lock.json
skillsee list --global                       # list from ~/.agents/.skill-lock.json
skillsee remove brainstorming               # remove skill from lock
skillsee remove --dry-run brainstorming     # preview removal
```

## What it does

- **Audit skill usage** — parse agent session logs and count which skills were invoked, when, and how often
- **Manage a skills lock** — list and remove skills from a local or global lock file

## Options

### `skillsee` / `skillsee summary`

Shows session counts for both agents. Accepts `--period` and `--since`.

```sh
skillsee           # last 7 days
skillsee -p 2w     # last 2 weeks
```

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --period` | `7d` | `7d`, `2w`, `1m`, `1y` |
| `--since` | — | `yyyy-mm-dd`, overrides `--period` |

### `skillsee audit`

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | required | `claude`, `codex`, comma- or space-separated |
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

### `skillsee list` / `ls`

```sh
skillsee list            # local skills-lock.json
skillsee list --global   # ~/.agents/.skill-lock.json
```

### `skillsee remove` / `rm`

```sh
skillsee remove <skill-name>
skillsee remove --global <skill-name>
skillsee remove --dry-run <skill-name>
```

## Requirements

- Node.js ≥ 18
