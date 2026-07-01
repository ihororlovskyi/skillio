# Changelog

## 0.1.15 (2026-07-01)

### Changed

- **`skl rm` plan/summary output is now colored and aggregated.** Real
  installs show `(N folders, M files)` in green; symlinked installs show
  `(N symlinks)` in yellow; the `skills-lock.json` line shows the exact
  number of lines that will change, in red. Multiple targets (including
  `rm .`) share one aggregated block instead of a header repeated per skill.
- **Lock cleanup is now an interactive question, not a flag.** `--force-lock`
  and its `-fl` alias are **removed**. After confirming disk removal, `rm`
  asks a second, independent `Clean skills-lock.json (N lines)? [y/n]`
  question whenever at least one target is in the lock. `--yes`/`-y` now
  answers **both** questions. **Breaking** for scripts relying on
  `--force-lock` or on `--yes` leaving the lock untouched.
- **`--dry-run` removed.** The plan is always printed before every
  confirmation, so a separate preview mode was redundant. **Breaking**.
- **New scoped flags**: `--lock-only`/`--lo` (unchanged behavior, new alias),
  `--agents-only`/`--ao`, and `--claude-only`/`--co` — each restricts `rm` to
  exactly one location (disk side or lock) with a single confirmation and no
  second question. Mutually exclusive with each other.
- **Confirmation prompts now read `[y/n]`** (was `[y/N]`); behavior for
  anything other than a literal `y`/`yes` answer is unchanged (still `false`).

## 0.1.14 (2026-06-01)

### Changed

- **`cost` short alias is now `cs`** (was `co`). `cst` is unchanged. `co` is
  no longer recognized. **Breaking** for anyone scripting `skl co`.
- **`skl rm .` replaces `skl rm --all`.** Use the positional `.` to target
  every skill in scope; `skl rm . -fl` (or `--force-lock`) also wipes lock
  entries. The `--all` flag is **removed**. **Breaking.**
- **`-fl` short alias for `--force-lock`.**
- **`rm` result block reformatted.** A blank line precedes the results; each
  skill prints a `"name"` header followed by per-source lines —
  `removed` (red), `kept` (green), `skipped` (yellow) — in the order
  `.agents/skills`, `.claude/skills`, `skills-lock.json`.
- **`skl ls` drops the "skills-lock.json has N skills missing on disk" line.**
  Lock orphans are already shown inline (red) in the lock row.
- **Bulk-remove confirm reverted to instant `y`.** `skl rm .` now asks
  `Remove ALL N skills?` and accepts a single `y` keypress (no Enter), like
  single-skill removal. The 0.1.13 typed-`all` guard is removed; `--yes` again
  skips the prompt entirely.

## 0.1.13 (2026-05-16)

### Added

- **`skl completion <bash|zsh|fish>`.** Prints a shell completion script that
  tab-completes subcommands, flags and (dynamically) skill names for `skl rm`.
  Source once in your rc-file; the script calls `skl list --names` under the
  hood, so completions track real on-disk state.
- **`skl list --names`.** Machine-readable mode that prints one unique skill
  name per line, union of `.agents/skills`, `.claude/skills` and the lock
  file, sorted, with no header and no colors. Designed for completion scripts
  and pipelines.
- **`skl rm --lock-only`.** Removes only the `skills-lock.json` entry and
  keeps on-disk directories intact. Mutually exclusive with `--force-lock`.
- **`skl usage`: `(missing)` suffix and `installed: boolean`.** Skills that
  have usage records but are no longer present in lock or on disk are tagged
  with a red `(missing)` suffix in text output; JSON output gains an
  `installed` field. Sort is `installed-first`.
- **`mo` period unit (30 days).** Use `6mo` to mean "the last 6 calendar
  months" (180 days). `m` continues to mean minute — the new `mo` unit
  removes the ambiguity around month-vs-minute in `-p`.
- **`rm --all` typed-phrase guard in TTY.** Interactive `rm --all` now
  requires typing the word `all` to confirm, even with `--yes`. Non-TTY
  scripts that pass `--yes` are unchanged.
- **Method label in `cost` summary.** The total line now ends with
  `· method: chars/4, yaml-frontmatter` so the estimation method is
  self-documenting.
- **CodeQL workflow** (`.github/workflows/codeql.yml`) and
  **OpenSSF Scorecard workflow** (`.github/workflows/scorecard.yml`).
- **Vitest coverage + Codecov upload.** New `npm run test:coverage` script
  and a `coverage` job in CI that uploads `lcov.info` to Codecov.

### Changed

- **`mentions` extractor normalizes plugin namespaces.** `superpowers:foo` is
  now reported as bare `foo`, matching the names emitted by `attributed` and
  `activations`. This removes a real double-count risk in `merged` mode when
  the same skill appeared with and without a namespace prefix.
- **`readers/claude.ts` mentions aggregation.** Switched from per-line
  accumulation to a session-level `Map` (`sessionMen`) plus post-file
  aggregation, matching the structure used by `attributed`/`activations`.
  Output counts are unchanged; the refactor removes a structural
  inconsistency flagged in code review.
- **`isRecentEntry` (jsonl.ts).** Entries with no timestamp (or `null`) now
  return `false` instead of `true`, removing inflation of short windows
  caused by stamp-less log lines.
- **Custom `skl remove --help`.** The remove subcommand now prints a
  formatted USAGE/ARGUMENTS/OPTIONS/EXAMPLES block instead of the generic
  citty layout.
- **Root help descriptions** updated to reflect 0.1.11+ semantics for `list`
  and `remove`.
- **README rewrite.** Period units (`60s/30m/24h/30d/2w/6mo/all`), `rm`
  semantics (disk-only by default, `--force-lock`, `--lock-only`, `--all`),
  default modes per agent (Claude → `merged`, Codex → `activations`).
- **README badges.** Added CodeQL, OpenSSF Scorecard, Codecov, license, and
  node-version shields alongside the existing npm and CI badges.

### Internal

- `@vitest/coverage-v8` added as a devDependency (no new runtime deps).

## 0.1.12 (2026-05-15)

Version bump only — the substantive changes drafted for this slot landed in
0.1.13. 0.1.12 on npm is identical to 0.1.11 except for the version field.

## 0.1.11 (2026-05-14)

### Breaking

- **`skl rm` no longer touches `skills-lock.json` by default.** Pass `--force-lock` to remove
  the lock entry. The previous "skip if git-tracked, override with `--force-lock`" logic is
  removed entirely. Scripts that relied on default lock removal need `--force-lock` added.
- **`--period` syntax cleanup.** `s/m/h/d/w` only. Notable: **`1m` now means 1 minute, not
  30 days.** Longhand `30sec`, `5min` and units `m` (month) / `y` (year) are rejected.
  Migration: `5min`→`5m`, `1m` (month)→`30d`, `1y`→`365d` or `52w`.

### Added

- **`skl rm --all`.** Wipes every skill in scope (disk only). Combine with `--force-lock`
  to also clear lock entries. Mutually exclusive with positional names.
- **Picker `remove` option.** Bare `skl` in TTY now shows `remove` in the main menu;
  selecting it opens a secondary picker listing every skill in scope. Orphans-on-disk
  (present on disk, missing from `skills-lock.json`) are labeled with a red `(orphan)`
  suffix to distinguish them from `cost`'s `missing` (in-lock, no `SKILL.md`).
- **Instant `y/N` confirm.** `skl rm` in a TTY resolves on a single keystroke — no Enter
  required. Pipes and CI still use the line-based readline fallback unchanged.

### Changed

- **`skl ls` redesign.** Row order is now `.agents/skills` → `.claude/skills` →
  `skills-lock.json`. Disk names are painted green for real directories and yellow for
  symlinks (`lstatSync` check). The `skills-lock.json` row shows only orphans-in-lock
  (entries with no disk presence in either source); an empty orphan set renders
  `All skills onboard!` in green.
- **`skl usage` spacing.** The blank line that used to appear before each agent header
  inside a scope is gone. Blank lines BEFORE the scope header (`Local`/`Global`) and
  BEFORE `Total:` are unchanged.

### Removed

- `src/utils/git.ts` (`isTrackedByGit`) — no longer used after the `rm` rewrite.

### History

The repository history of `.gitignore` is rewritten via `git filter-repo --blob-callback`
to drop seven legacy patterns from every historical revision. Existing clones must
`git fetch --all --tags --force && git reset --hard origin/main`. Provenance attestations
for v0.1.0–v0.1.10 reference pre-rewrite SHAs that no longer exist (Sigstore signatures
remain valid; repo-SHA chain is broken for those versions). v0.1.11 establishes a fresh
chain.

## 0.1.10 (2026-05-13)

### Fixes
- `skl usage` (claude-code, attributed/merged modes): same skill re-invoked
  after a non-attributed line is now counted as a separate invocation.
- `skl usage` (codex, function_call exec_command): only read-like commands
  (`cat`, `sed`, `head`, `tail`, `bat`, `batcat`, `less`, `more`) are
  counted. Skips output redirection (`>`, `>>`, `2>`, `&>`) and heredoc
  bodies. Fixes false positives from fixture-generation and search commands.

### Features
- Bare `skl` in a TTY shows an interactive picker
  ({usage, cost, list, quit}). Non-TTY invocations (CI, pipes) preserve
  the legacy bare→cost behavior. `remove` is intentionally omitted from
  the menu and will return in a future iteration with a skill-name picker.
- `skl rm` now skips modifying `skills-lock.json` when the file is
  git-tracked; warning to stderr. Pass `--force-lock` to override.
- `skl usage` no longer renders skills with `count=0`.
- `skl cost` shows `~? tok  missing` (red) for skills missing from disk.
- `skl list` always renders three source rows (`.claude/skills`,
  `.agents/skills`, `skills-lock.json`) with `0 skills` for empty sources.

### Style
- Blank line moved to BEFORE `Local`/`Global`/`Total` headers (was after).

## 0.1.8 (2026-05-12)

### Breaking Changes

- **`skl` (bare, no subcommand)** now runs `skl cost` instead of the
  Global + Local + Total summary. For per-agent activations + consumption,
  run `skl usage`.
- `skl summary` subcommand removed (it was the previous bare behavior).

### Added

- `skl cst` alias for `skl cost` (and existing `co`).
- `skl usg` alias for `skl usage` (and existing `us`).
- Cyan highlighting for skill names in `skl cost`, `skl ls`, and `skl usage` output.
- Dependabot: automatic weekly PRs for npm deps and GitHub Actions versions.
- CI: matrix on Node 20 + 22 with `fail-fast: false` and a per-ref concurrency group; adds a `tsc --noEmit` typecheck step.

### Internal

- `.github/actions/checks` composite action holds the shared lint/typecheck/unit/build/e2e sequence; both `ci.yml` and `release.yml` call it (zero duplication).
