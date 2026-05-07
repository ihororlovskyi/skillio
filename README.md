# skvisor

Audit and manage AI agent skills for Claude Code and OpenAI Codex.

## Installation

```sh
# one-off (no install needed)
npx skvisor --agent claude --period 7d
pnpm dlx skvisor --agent codex --period 2w

# global install
npm install -g skvisor
pnpm add -g skvisor
```

## Usage

```sh
skvisor --agent claude --period 7d          # audit last 7 days (attributed mode)
skvisor --agent codex --mode activations    # codex activations
skvisor --agent claude,codex --period 2w   # both agents, last 2 weeks
skvisor list                                # list skills in local skills-lock.json
skvisor list --global                       # list from ~/.agents/.skill-lock.json
skvisor remove brainstorming               # remove skill from lock
skvisor remove --dry-run brainstorming     # preview removal
```

## What it does

- **Audit skill usage** — parse agent session logs and count which skills were invoked, when, and how often
- **Manage a skills lock** — list and remove skills from a local or global lock file

## Options

### `skvisor audit` (default command)

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | required | `claude`, `codex`, or comma-separated |
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

### `skvisor list` / `ls`

```sh
skvisor list            # local skills-lock.json
skvisor list --global   # ~/.agents/.skill-lock.json
```

### `skvisor remove` / `rm`

```sh
skvisor remove <skill-name>
skvisor remove --global <skill-name>
skvisor remove --dry-run <skill-name>
```

## Requirements

- Node.js ≥ 18
