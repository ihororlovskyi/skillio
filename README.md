# sklx

[![npm version](https://img.shields.io/npm/v/skl-x)](https://www.npmjs.com/package/skl-x)
[![CI](https://github.com/sentimony/skl-x/actions/workflows/ci.yml/badge.svg)](https://github.com/sentimony/skl-x/actions/workflows/ci.yml)
[![CodeQL](https://github.com/sentimony/skl-x/actions/workflows/codeql.yml/badge.svg)](https://github.com/sentimony/skl-x/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/sentimony/skl-x/badge)](https://securityscorecards.dev/viewer/?uri=github.com/sentimony/skl-x)
[![codecov](https://codecov.io/gh/sentimony/skl-x/branch/main/graph/badge.svg)](https://codecov.io/gh/sentimony/skl-x)
[![license](https://img.shields.io/npm/l/skl-x)](https://github.com/sentimony/skl-x/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/skl-x)](https://www.npmjs.com/package/skl-x)

Install, audit and manage AI agent skills for Claude Code and Codex.

## Quick start

```sh
npm install -g skl-x                              # provides `skl-x`, `sklx` and `skl`

skl i sentimony/skills -a codex claude-code -y    # install published skills (npx skills add)
skl i -ln ../skills -a codex claude-code -y       # or symlink every skill from a local clone
skl                                               # ambient token cost per skill
skl ls                                            # which skills are where
skl usage -p 7d                                   # which skills were used last week
skl rm tdd                                        # remove a skill from disk and lock
```

## Migrating from @sentimony/sklx or skillio

`skillio` and `@sentimony/sklx` are renamed to `skl-x` (commands `skl-x`, `sklx` and `skl`). All
three packages install the `skl` bin, so remove the old one first:

```sh
npm rm -g @sentimony/sklx skillio && npm i -g skl-x
```

`SKILLIO_NO_UPDATE_CHECK` is now `SKLX_NO_UPDATE_CHECK`.

## Install skills

`skl install` / `skl i` works in one of two modes.

### Published skills

Without `-ln`, `skl i` runs `npx -y skills add` with the same arguments in the same order and
returns its exit code. Every [source format](https://github.com/vercel-labs/skills#source-formats)
and option of `npx skills add` works as is.

```sh
# GitHub shorthand (owner/repo)
skl i sentimony/skills

# Full GitHub URL
skl i https://github.com/sentimony/skills

# List skills in a repository
skl i sentimony/skills -l

# Install specific skills to specific agents, non-interactive
skl i sentimony/skills -s tdd cross-review -a codex claude-code -y

# Hide the npx skills output, print a summary and a table
skl i sentimony/skills -s tdd -a codex claude-code -y -m s
```

With `-m s` (`--mode silent`):

```text
Installing from sentimony/skills...
Installed 1 skill from sentimony/skills
skill  .agents    .claude    skills-lock.json
tdd    universal  symlinked  +
```

`-m s` needs `-y`: otherwise `npx skills add` asks questions. If `npx` fails, its full output is
printed.

### Local clone

`skl i -ln <path>` (`--link`) symlinks `<path>/skills/<name>` into `.agents/skills` and
`.claude/skills`. The links point straight at the clone, so edits there show up without
reinstalling.

```sh
# Every skill in the clone
skl i -ln ../skills -a codex claude-code -y

# Every skill except the listed ones
skl i -ln ../skills -x scope-check echarts -y

# Only the listed skills
skl i -ln ../skills -s tdd cross-review

# Only .claude/skills
skl i -ln ../skills -s tdd -a claude-code -y
```

```text
Symlinked 2 skills from ../skills
skill         .agents    .claude    skills-lock.json
cross-review  symlinked  symlinked  -
tdd           symlinked  symlinked  -
```

- Without `-s`, every `<path>/skills/<name>/SKILL.md` is linked, except skills with
  `metadata.internal: true` (as `npx skills add` does).
- An existing copy or another symlink with the same name is replaced after a
  `Replace N existing skills?` prompt, or at once with `-y`.
- `skills-lock.json` is not changed. Global scope (`-g`) is not supported yet.

| Option | Description |
|---|---|
| `-ln, --link` | Symlink from a local clone instead of running `npx skills add` |
| `-s, --skill <names...>` | Only these skills; a name starting with a space is skipped |
| `-x, --reject <names...>` | Every skill except these (not with `-s`) |
| `-a, --agent <agents...>` | `codex` (`.agents/skills`), `claude-code` (`.claude/skills`); default: both |
| `-y, --yes` | Skip `npx` prompts; with `-ln`: replace existing copies without asking |
| `-m, --mode silent` | Hide the `npx` output (needs `-y`); no effect with `-ln` |

## Commands

| Command | Alias | Description |
|---|---|---|
| `skl install` | `i` | Install published skills or symlink a local clone |
| `skl list` | `ls` | Table of skills: `.agents`, `.claude` and lock per skill |
| `skl cost` | `cst` | Ambient context cost per skill (also `skl` with no command) |
| `skl usage` | `usg` | Skill usage from agent session logs × cost |
| `skl remove` | `rm` | Remove skills from disk and `skills-lock.json` |
| `skl completion` | | Print a shell completion script |

### `skl cost`

```sh
skl                  # same as skl cost
skl cost -g          # global scope
```

Per-skill ambient token cost (`name` + `description`, chars/3), sorted descending. Skills with
`disable-model-invocation: true` show `-` and stay out of the total.

### `skl list`

```sh
skl ls
skl ls -g
```

```text
Project Scope
skill            .agents    .claude    skills-lock.json
cross-review     universal  symlinked  +
echarts          -          copied     -
old-skill        -          -          +
webapp-debugger  symlinked  broken     -
4 skills         2          3          2
```

| Cell | Meaning |
|---|---|
| `universal` | a folder in `.agents/skills` (the canonical copy of `npx skills`) |
| `copied` | a folder in `.claude/skills` |
| `symlinked` | a symlink, to `.agents/skills` or to a local clone |
| `broken` | a symlink whose target is gone |
| `-` | not there |
| `+` | in the lock; red when the skill is on neither disk |

`skl ls --names` prints one name per line; the completion scripts use it.

### `skl usage`

Audits skill usage from agent session logs.

```sh
skl usage --agent claude --period 7d
skl usage --agent codex --mode activations
```

| Flag | Default | Description |
|------|---------|-------------|
| `-a, --agent` | both | `claude-code`/`claude`, `codex` |
| `-p, --period` | `all` | `60s`, `30m`, `24h`, `7d`, `2w`, `6mo`, `all` |
| `--since` | - | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | `merged` (claude) / `activations` (codex) | `merged` \| `attributed` \| `activations` \| `mentions` |
| `--format` | `text` | `text` \| `json` |
| `-g, --global` | `false` | Force global scope (ignore current directory) |
| `--root` | - | Override agent sessions directory; implies global |
| `--scan-all-files` | - | Ignore file mtime, read everything |

#### Modes

- **`merged`** - per-session union of `attributed` and `activations` (`max` per skill). Default for Claude.
- **`attributed`** - entries with an `attributionSkill` field set by Claude Code.
- **`activations`** - explicit `Skill` tool invocations (Claude) or read-like `exec_command_end` events / `<skill>` XML (Codex). Default for Codex.
- **`mentions`** - skill paths (`foo/SKILL.md`) or `superpowers:name` strings found anywhere. Broadest signal; can include matches from prompts, specs, or documentation.

### `skl remove`

```sh
skl rm <skill-name>                 # colored plan, Proceed? [y/n], then Clean lock? [y/n]
skl rm <skill-one> <skill-two>      # one pair of prompts
skl rm .                            # every skill in scope
skl rm . -x <one> <two>             # every skill except the listed ones (alias --reject)
skl rm --yes <skill-name>           # skip both prompts and the plan
skl rm . -y -m s                    # one line: Executed A/B/C skills (--mode silent)
skl rm --lock-only <skill-name>     # only the lock entry; keep on disk
skl rm --agents-only <skill-name>   # only .agents/skills; keep .claude/skills and lock
skl rm --claude-only <skill-name>   # only .claude/skills; keep .agents/skills and lock
skl rm -g <skill-name>              # global scope
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

## Scope

`sklx` / `skl` automatically picks a scope based on your current directory:

| where you run it | scope |
|------------------|-------|
| inside a git repo | that repo only (data filtered to its path) |
| in `$HOME` exactly | global - all repos on this machine |
| anywhere with `-g` / `--global` | global override |
| with `--root <dir>` | that exact dir, treated as global |

## Global flags

| Flag | Default | Description |
|------|---------|-------------|
| `-h, --help` | - | Show help and exit |
| `-v, --version` | - | Show version and exit |
| `-g, --global` | `false` | Use global scope (ignore current directory) |
| `-p, --period` | `all` | Period for `usage`: `60s`, `30m`, `12h`, `7d`, `2w`, `6mo`, `all` (note: `1m` = 1 minute, `1mo` = 30 days) |
| `-a, --agent` | both | Agent for `usage`: `claude-code` (alias `claude`), `codex` - pass both space-separated (`-a claude-code codex`) or repeat the flag |

## Installing sklx
```sh
# one-off (no install needed)
npx -y skl-x --agent claude --period 7d
pnpm dlx skl-x --agent codex --period 2w

# global install - provides `skl-x`, `sklx` and `skl` commands in $PATH
npm install -g skl-x  # recommended
pnpm add -g skl-x
```

### Local install (per-project)

If you'd rather pin `sklx` to a single project (e.g. for CI) instead of
installing globally:

```sh
npm install -D skl-x  # adds to devDependencies
pnpm add -D skl-x
yarn add -D skl-x
bun add -d skl-x
```

Then run via your package manager - both `sklx` and `skl` are exposed:

```sh
npx sklx                     # works from any subdir of the project
pnpm exec skl                # short alias
yarn skl
bun x sklx
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

> Already have `sklx` installed? Get the latest version:

```sh
npm install -g skl-x@latest  # recommended
pnpm add -g skl-x@latest
```

## Requirements

- Node.js ≥ 20
