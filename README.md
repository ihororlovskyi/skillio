# skillio

[![npm version](https://img.shields.io/npm/v/skillio)](https://www.npmjs.com/package/skillio)
[![CI](https://github.com/ihororlovskyi/skillio/actions/workflows/ci.yml/badge.svg)](https://github.com/ihororlovskyi/skillio/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ihororlovskyi/skillio/actions/workflows/codeql.yml/badge.svg)](https://github.com/ihororlovskyi/skillio/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/ihororlovskyi/skillio/badge)](https://securityscorecards.dev/viewer/?uri=github.com/ihororlovskyi/skillio)
[![codecov](https://codecov.io/gh/ihororlovskyi/skillio/branch/main/graph/badge.svg)](https://codecov.io/gh/ihororlovskyi/skillio)
[![license](https://img.shields.io/npm/l/skillio)](https://github.com/ihororlovskyi/skillio/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/skillio)](https://www.npmjs.com/package/skillio)

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
# bare command — per-skill ambient token cost, sorted desc, with verdict
skl
skillio                                # equivalent

# subcommands
skl ls                                 # list skills per source with diffs
skl cost                               # ambient ballast cost (frontmatter tokens) per skill
skl cs                                 # alias for cost (also: cst)
skl usage                              # consumption: usage count × frontmatter tokens
skl usg                                # alias for usage
skl rm brainstorming                   # colored plan, Proceed? [y/n], then Clean lock? [y/n]
skl rm brainstorming writing-plans     # remove multiple, one pair of prompts
skl rm .                               # remove all skills in scope
skl rm . -x web-debug typescript       # remove all except listed (alias --reject)
skl rm --yes brainstorming             # skip both prompts
skl rm brainstorming --lock-only       # only the lock entry (alias --lo)
skl rm brainstorming --agents-only     # only .agents/skills (alias --ao)
skl rm brainstorming --claude-only     # only .claude/skills (alias --co)

# scope flags
skl -g                                 # force global scope on any subcommand
skl usage -p 7d                        # last 7 days
skl usage -a claude-code codex         # both agents (space-separated)
skl usage -a claude -a codex           # equivalent: repeated --agent flag
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

- **Cost** (`skl`) — per-skill ambient token cost sorted descending, with a cleanup verdict. Bare `skl` = `skl cost` in local scope; `skl -g` = global scope.
- **Audit skill usage** (`skl usage`) — parse agent session logs and count which skills were invoked, when, and how often.
- **Manage a skills lock** (`skl ls`, `skl rm`) — inspect and remove skills from a local or global lock file.

## Options

### Global flags

| Flag | Default | Description |
|------|---------|-------------|
| `-h, --help` | — | Show help and exit |
| `-v, --version` | — | Show version and exit |
| `-g, --global` | `false` | Use global scope (ignore current directory) |
| `-p, --period` | `all` | Period for `usage`: `60s`, `30m`, `12h`, `7d`, `2w`, `6mo`, `all` (note: `1m` = 1 minute, `1mo` = 30 days) |
| `-a, --agent` | both | Agent for `usage`: `claude-code` (alias `claude`), `codex` — pass both space-separated (`-a claude-code codex`) or repeat the flag |

### `skillio usage` / `us`

Audits skill usage from agent session logs.

```sh
skillio usage --agent claude --period 7d
skillio usage --agent codex --mode activations
```

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | both | `claude-code`/`claude`, `codex` |
| `-p, --period` | `all` | `60s`, `30m`, `24h`, `7d`, `2w`, `6mo`, `all` |
| `--since` | — | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | `merged` (claude) / `activations` (codex) | `merged` \| `attributed` \| `activations` \| `mentions` |
| `--format` | `text` | `text` \| `json` |
| `-g, --global` | `false` | Force global scope (ignore current directory) |
| `--root` | — | Override agent sessions directory; implies global |
| `--scan-all-files` | — | Ignore file mtime, read everything |

### Modes

- **`merged`** — per-session union of `attributed` and `activations` (`max` per skill). Default for Claude.
- **`attributed`** — entries with an `attributionSkill` field set by Claude Code.
- **`activations`** — explicit `Skill` tool invocations (Claude) or read-like `exec_command_end` events / `<skill>` XML (Codex). Default for Codex.
- **`mentions`** — skill paths (`foo/SKILL.md`) or `superpowers:name` strings found anywhere. Broadest signal; can include matches from prompts, specs, or documentation.

### `skillio list` / `ls`

```sh
skillio list            # local skills-lock.json
skillio list --global   # ~/.agents/.skill-lock.json
```

### `skillio cost` / `cs`

```sh
skillio cost            # local: per-skill frontmatter tokens with verdict
skillio cost --global   # same, against ~/.agents/.skill-lock.json
```

### `skillio remove` / `rm`

```sh
skillio remove <skill-name>               # colored plan/summary, two prompts (disk, then lock)
skillio remove <skill-one> <skill-two>
skillio remove .                          # remove all skills in scope
skillio remove . -x <one> <two>           # remove all except listed (alias --reject)
skillio remove --lock-only <skill-name>   # only the lock entry; keep on disk (alias --lo)
skillio remove --agents-only <skill-name> # only .agents/skills; keep .claude/skills and lock (alias --ao)
skillio remove --claude-only <skill-name> # only .claude/skills; keep .agents/skills and lock (alias --co)
skillio remove --global <skill-name>
skillio remove --yes <skill-name>         # skip both confirmation prompts
```

### Shell completion

`skl completion <shell>` prints a completion script. Sourced once in your
rc-file, it tab-completes subcommands and dynamic skill names for `skl rm`.

```sh
# bash (one-time setup)
skl completion bash >> ~/.bashrc

# zsh
skl completion zsh >> ~/.zshrc

# fish
skl completion fish | source            # one-off in current shell
skl completion fish > ~/.config/fish/completions/skl.fish
```

`skl list --names` prints one skill name per line (no headers, no colors) and
is what the completion script calls under the hood.

## Requirements

- Node.js ≥ 20
