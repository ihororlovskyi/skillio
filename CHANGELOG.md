# Changelog

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
