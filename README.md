# skl-x

Install, audit and manage AI agent skills for Claude Code and Codex.

[![npm version](https://img.shields.io/npm/v/skl-x)](https://www.npmjs.com/package/skl-x)
[![npm downloads](https://img.shields.io/npm/dm/skl-x)](https://www.npmjs.com/package/skl-x)
[![CI](https://github.com/sentimony/skl-x/actions/workflows/ci.yml/badge.svg)](https://github.com/sentimony/skl-x/actions/workflows/ci.yml)
[![CodeQL](https://github.com/sentimony/skl-x/actions/workflows/codeql.yml/badge.svg)](https://github.com/sentimony/skl-x/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/sentimony/skl-x/badge)](https://securityscorecards.dev/viewer/?uri=github.com/sentimony/skl-x)
[![codecov](https://codecov.io/gh/sentimony/skl-x/branch/main/graph/badge.svg)](https://codecov.io/gh/sentimony/skl-x)
[![license](https://img.shields.io/npm/l/skl-x)](https://github.com/sentimony/skl-x/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/skl-x)](https://www.npmjs.com/package/skl-x)

## Install skills

```sh
npx -y skl-x i sentimony/skills
```

`skl-x i` runs `npx -y skills add` with the same arguments, so every
[source format](https://github.com/vercel-labs/skills#source-formats) and option of
`npx skills add` works as is.

```sh
# List skills in a repository
npx -y skl-x i sentimony/skills -l

# Specific skills to specific agents, non-interactive
npx -y skl-x i sentimony/skills -s tdd cross-review -a codex claude-code -y

# Hide the npx skills output, print a progress line and a table (needs -y)
npx -y skl-x i sentimony/skills -s tdd -a codex claude-code -y -m s
```

```text
Installing from https://github.com/sentimony/skills ██████████ 100% · Installed 1 skill
skill  .agents    .claude    skills-lock.json  cost
tdd    universal  symlinked  +                 ~125 tok
```

In a terminal the bar fills while `npx` runs; in scripts and CI only the final line is printed.
If `npx` fails, its full output is printed.

### Local skills

`-ln <path>` (`--link`) symlinks `<path>/skills/<name>` into `.agents/skills` and
`.claude/skills`. The links point straight at the clone, so edits there show up without
reinstalling.

```sh
# Every skill in the clone
npx -y skl-x i -ln ../skills -a codex claude-code -y

# Every skill except the listed ones
npx -y skl-x i -ln ../skills -x scope-check echarts -y

# Only the listed skills, only .claude/skills
npx -y skl-x i -ln ../skills -s tdd cross-review -a claude-code
```

```text
Symlinking from ../skills ██████████ 100% · Symlinked 2 skills
skill         .agents    .claude    skills-lock.json  cost
cross-review  symlinked  symlinked  -                 ~186 tok
tdd           symlinked  symlinked  -                 ~125 tok
```

- Without `-s`, every `<path>/skills/<name>/SKILL.md` is linked, except skills with
  `metadata.internal: true` (as `npx skills add` does).
- An existing copy or symlink with the same name is replaced after a
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

## Cost

```sh
npx -y skl-x cost       # project scope
npx -y skl-x cost -g    # global scope
```

Per-skill ambient token cost (`name` + `description`, chars/3), sorted descending. Skills with
`disable-model-invocation: true` show `-` and stay out of the total.

## Usage

Skill usage from agent session logs, multiplied by cost.

```sh
npx -y skl-x usage -a claude -p 7d
npx -y skl-x usage -a codex --mode activations
```

```text
Project scope · Usage 22 times by 7d
skill         .agents  .claude  cost      total
cross-review  9        2        ~186 tok  ~2,046 tok
tdd           0        11       ~125 tok  ~1,375 tok
2 skills      9        13       ~311 tok  ~3,421 tok
```

`.agents` counts Codex runs, `.claude` - Claude Code runs; `total` is cost × runs. A skill that
is no longer installed is shown in red with `~? tok`.

| Flag | Default | Description |
|---|---|---|
| `-a, --agent` | both | `claude-code` (`claude`), `codex` |
| `-p, --period` | `all` | `60s`, `30m`, `24h`, `7d`, `2w`, `6mo`, `all` (`1m` is a minute, `1mo` is 30 days) |
| `--since` | - | `yyyy-mm-dd`, overrides `--period` |
| `--mode` | `merged` (claude) / `activations` (codex) | `merged`, `attributed`, `activations`, `mentions` |
| `--format` | `text` | `text`, `json` |
| `-g, --global` | `false` | Global scope |
| `--root` | - | Agent sessions directory; implies global |
| `--scan-all-files` | - | Ignore file mtime, read everything |

- **`merged`** - per-session union of `attributed` and `activations` (`max` per skill).
- **`attributed`** - entries with an `attributionSkill` field set by Claude Code.
- **`activations`** - `Skill` tool calls (Claude), read-like `exec_command_end` events or
  `<skill>` XML (Codex).
- **`mentions`** - `foo/SKILL.md` paths or `superpowers:name` strings anywhere. The broadest
  signal; can match prompts, specs or docs.

## Other commands

| Command | Alias | Description |
|---|---|---|
| `skl-x list` | `ls` | Table of skills: `.agents`, `.claude`, lock and cost per skill |
| `skl-x remove` | `rm` | Remove skills from disk and `skills-lock.json` |
| `skl-x completion` | | Print a shell completion script |

`skl-x` with no command opens a menu in a terminal and prints `cost` otherwise.

### `skl-x list`

```text
Project scope
skill            .agents    .claude    skills-lock.json  cost
cross-review     universal  symlinked  +                 ~186 tok
echarts          -          copied     -                 ~98 tok
old-skill        -          -          +                 ~? tok
webapp-debugger  symlinked  broken     -                 ~? tok
4 skills         2          3          2                 ~284 tok
```

| Cell | Meaning |
|---|---|
| `universal` | a folder in `.agents/skills` (the canonical copy of `npx skills`) |
| `copied` | a folder in `.claude/skills` |
| `symlinked` | a symlink, to `.agents/skills` or to a local clone |
| `broken` | a symlink whose target is gone |
| `-` | not there |
| `+` | in the lock; red when the skill is on neither disk |

`skl-x ls --names` prints one name per line, for scripts and completion.

### `skl-x remove`

```sh
skl-x rm tdd                     # plan, Proceed? [y/n], then Clean lock? [y/n]
skl-x rm .                       # every skill in scope
skl-x rm . -x tdd cross-review   # every skill except the listed ones
skl-x rm tdd -y                  # no prompts, no plan
skl-x rm . -y -m s               # one line: Executed A/B/C skills
skl-x rm tdd --lock-only         # also --agents-only, --claude-only
skl-x rm tdd -g                  # global scope
```

### `skl-x completion`

Tab-completes subcommands and skill names for `rm`. Needs a global install.

```sh
skl-x completion bash >> ~/.bashrc
skl-x completion zsh >> ~/.zshrc
skl-x completion fish > ~/.config/fish/completions/skl.fish
```

## Scope

| Where you run it | Scope |
|---|---|
| inside a git repo | that repo |
| in `$HOME` | global: every repo on this machine |
| with `-g` / `--global` | global |
| with `--root <dir>` | that directory, as global |

## Global install

```sh
npm i -g skl-x    # provides `skl-x` and the short `skl`
```

Moving from `@sentimony/sklx` or `skillio`: all three packages install the `skl` bin, so
remove the old one first:

```sh
npm rm -g @sentimony/sklx skillio && npm i -g skl-x
```

To skip the daily update check set `SKL_X_NO_UPDATE_CHECK=1` (`SKLX_NO_UPDATE_CHECK` still
works).

Requires Node.js 22 or newer.

## License

[MIT](LICENSE)
