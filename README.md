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
# bare command — quick summary across global + local sources, with verdict
skl
skillio                                # equivalent

# subcommands
skl ls                                 # list skills per source with diffs
skl cost                               # ambient ballast cost (frontmatter tokens) per skill
skl usage                              # consumption: usage count × frontmatter tokens
skl rm brainstorming                   # remove from lock + delete on-disk dir (with Y/n prompt)
skl rm brainstorming writing-plans     # remove multiple
skl rm --yes brainstorming             # skip confirmation
skl rm --dry-run brainstorming         # preview only

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

> Bare `skl` (no subcommand) ignores `-g` — it always shows both Global and Local sections plus a grand Total.

## What it does

- **Summary** (`skl`) — counts and tokens across `.claude/skills`, `.agents/skills`, and `skills-lock.json` for both global and local scopes, with a cleanup verdict.
- **Audit skill usage** (`skl usage`) — parse agent session logs and count which skills were invoked, when, and how often.
- **Manage a skills lock** (`skl ls`, `skl rm`) — inspect and remove skills from a local or global lock file.

## Options

### Global flags

| Flag | Default | Description |
|------|---------|-------------|
| `-h, --help` | — | Show help and exit |
| `-v, --version` | — | Show version and exit |
| `-g, --global` | `false` | Use global scope (ignore current directory) |
| `-p, --period` | `all` | Period for `usage`: `30sec`, `5min`, `12h`, `7d`, `2w`, `1m`, `1y`, `all` |
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

### `skillio cost` / `co`

```sh
skillio cost            # local: per-skill frontmatter tokens with verdict
skillio cost --global   # same, against ~/.agents/.skill-lock.json
```

### `skillio remove` / `rm`

```sh
skillio remove <skill-name>
skillio remove <skill-one> <skill-two>
skillio remove --global <skill-name>
skillio remove --dry-run <skill-name>
skillio remove --yes <skill-name>      # skip confirmation prompt
```

## Requirements

- Node.js ≥ 20
