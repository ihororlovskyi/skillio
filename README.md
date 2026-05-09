# skillio

[![npm version](https://img.shields.io/npm/v/skillio)](https://www.npmjs.com/package/skillio)
[![CI](https://github.com/ihororlovskyi/skillio/actions/workflows/ci.yml/badge.svg)](https://github.com/ihororlovskyi/skillio/actions/workflows/ci.yml)

Audit and manage AI agent skills for Claude Code and OpenAI Codex.

## Installation

```sh
# one-off (no install needed)
npx skillio --agent claude --period 7d
pnpm dlx skillio --agent codex --period 2w

# global install — provides both `skillio` and `skl` commands in $PATH
npm install -g skillio       # recommended
pnpm add -g skillio
```

### Local install (per-project)

If you'd rather pin `skillio` to a single project (e.g. for CI) instead of
installing globally:

```sh
npm install -D skillio       # adds to devDependencies
pnpm add -D skillio
yarn add -D skillio
bun add -d skillio
```

Then run via your package manager — both `skillio` and `skl` are exposed:

```sh
npx skillio                  # works from any subdir of the project
pnpm exec skl                # short alias
yarn skl
bun x skillio
```

You can also wire it into `package.json` scripts:

```json
{
  "scripts": {
    "audit:skills": "skl"
  }
}
```

…then `npm run audit:skills`.

## Updating

> Already have `skillio` installed? Get the latest version:

```sh
npm install -g skillio@latest        # recommended
pnpm add -g skillio@latest
```

If you're on `0.1.3` or older — please upgrade. Newer versions add per-repo
scoping, the `skl` short alias, and saner defaults (`skillio` with no flags now
audits both Claude Code and Codex over all time).

## Usage

```sh
# from any repo: scoped to that repo
skl                                    # both agents, all-time, this repo only
skl -a claude --period 7d              # claude only, last 7 days, this repo

# from $HOME (or anywhere with -g): global, all repos on this machine
cd ~ && skl                            # auto-global when cwd === $HOME
skl -g                                 # force global from any repo
skl --global --period 1m               # global, last 30 days

skillio …                              # same binary, longer alias
skillio -a claude-code codex           # both agents (space-separated)
skillio -a claude -a codex             # equivalent: repeated --agent flag
skillio list                           # list skills in local skills-lock.json
skillio list --global                  # list from ~/.agents/.skill-lock.json
skillio remove brainstorming           # remove skill from lock
skillio remove brainstorming writing-plans  # remove multiple skills
skillio remove --dry-run brainstorming # preview removal
```

### Scope (per-repo vs global)

`skillio` / `skl` automatically picks a scope based on your current directory:

| where you run it | scope |
|------------------|-------|
| inside a git repo | that repo only (data filtered to its path) |
| in `$HOME` exactly | global — all repos on this machine |
| anywhere with `-g` / `--global` | global override |
| with `--root <dir>` | that exact dir, treated as global |

## What it does

- **Audit skill usage** — parse agent session logs and count which skills were invoked, when, and how often
- **Manage a skills lock** — list and remove skills from a local or global lock file

## Options

### `skillio` (audit)

Audits skill usage from agent session logs. This is the default operation —
no subcommand keyword is needed.

```sh
skillio --agent claude --period 7d
skillio --agent codex --mode activations
```

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | both | `claude-code`/`claude`, `codex` — pass both space-separated (`-a claude-code codex`) or repeat the flag (`-a claude -a codex`) |
| `-p, --period` | `all` | `7d`, `2w`, `1m`, `1y`, `all` |
| `--since` | — | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | `attributed` (claude) / `activations` (codex) | `attributed` \| `activations` \| `mentions` |
| `--format` | `text` | `text` \| `json` |
| `-g, --global` | `false` | Force global scope (ignore current directory) |
| `--root` | — | Override agent sessions directory; implies global |
| `--scan-all-files` | — | Ignore file mtime, read everything |

### Modes

- **`attributed`** — entries with an `attributionSkill` field set by Claude Code. This is the default and most reliable Claude mode.
- **`activations`** — explicit `Skill` tool invocations found anywhere in the entry tree (Claude) or `exec_command_end` events / `<skill>` XML (Codex). This is the default and most reliable Codex mode.
- **`mentions`** — skill paths (`foo/SKILL.md`) or `superpowers:name` strings found in any string value. This is a broad search mode and can include examples from prompts, specs, or documentation.

### `skillio list` / `ls`

```sh
skillio list            # local skills-lock.json
skillio list --global   # ~/.agents/.skill-lock.json
```

### `skillio remove` / `rm`

```sh
skillio remove <skill-name>
skillio remove <skill-one> <skill-two>
skillio remove --global <skill-name>
skillio remove --dry-run <skill-name>
```

## Requirements

- Node.js ≥ 20
