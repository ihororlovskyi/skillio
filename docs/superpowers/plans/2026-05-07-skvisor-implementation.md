# skvisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing `scripts/*.mjs` audit tools as a fully typed, tested, published CLI package named `skvisor`.

**Architecture:** Pure TypeScript modules in `src/` compiled by Bunup to `dist/`. CLI entry point uses `citty` (bundled into dist — zero npm runtime deps). Extractors are pure functions `(entry: unknown) => string[]` tested in isolation; readers compose them with filesystem I/O; commands wire readers to citty argument parsing.

**Tech Stack:** TypeScript · Bun · Bunup · Biome · Vitest · citty · Changesets

---

## File Map

```
src/
  cli.ts                      entry point (bin)
  index.ts                    public API re-exports
  commands/
    audit.ts                  audit command + runAudit()
    list.ts                   list command
    remove.ts                 remove command
  readers/
    claude.ts                 reads ~/.claude/projects/**/*.jsonl
    codex.ts                  reads ~/.codex/sessions/**/*.jsonl or history
  extractors/
    attributed.ts             entry → string[]  (attributionSkill field)
    attributed.test.ts
    activations.ts            entry → string[]  (Skill tool_use / exec cmds)
    activations.test.ts
    mentions.ts               entry → string[]  (SKILL.md paths, superpowers:)
    mentions.test.ts
  lock/
    file.ts                   read/write/remove skills-lock.json  (atomic)
    file.test.ts
  utils/
    expand-home.ts            "~/.foo" → absolute path
    period.ts                 "7d" → number of days
    period.test.ts
    jsonl.ts                  findJsonlFiles() + isRecentEntry()
test/
  fixtures/
    claude/sample.jsonl
    codex/sample.jsonl
    lock/skills-lock.json
  e2e/
    helpers.ts
    audit-claude.test.ts
    audit-codex.test.ts
    list.test.ts
    remove.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`, `biome.json`, `bunup.config.ts`, `vitest.config.ts`, `vitest.e2e.config.ts`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "skvisor",
  "version": "0.1.0",
  "description": "Audit and manage AI agent skills for Claude Code and Codex",
  "type": "module",
  "bin": {
    "skvisor": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "bunup",
    "lint": "biome check src/",
    "format": "biome format --write src/",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "release": "changeset publish",
    "prepublishOnly": "biome check src/ && vitest run && bunup && vitest run --config vitest.e2e.config.ts",
    "skills:used": "node scripts/skills-used.mjs",
    "skills:list": "node scripts/skills-lock.mjs list",
    "skills:list:global": "node scripts/skills-lock.mjs list --global",
    "skills:remove": "node scripts/skills-lock.mjs remove",
    "skills:remove:global": "node scripts/skills-lock.mjs remove --global",
    "sync": "bash scripts/sync-after-history-rewrite.sh",
    "sync:claude": "bash scripts/sync-claude-settings.sh"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@changesets/cli": "^2.27.0",
    "bunup": "^0.9.0",
    "citty": "^0.1.6",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "trailingCommas": "all" }
  }
}
```

- [ ] **Step 4: Create bunup.config.ts**

```typescript
import { defineConfig } from 'bunup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    outDir: 'dist',
  },
])
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Create vitest.e2e.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
  },
})
```

- [ ] **Step 7: Install dependencies**

```sh
bun install
```

Expected: `node_modules/` created with biome, bunup, citty, typescript, vitest.

- [ ] **Step 8: Commit**

```sh
git add package.json tsconfig.json biome.json bunup.config.ts vitest.config.ts vitest.e2e.config.ts bun.lockb
git commit -m "chore: scaffold skvisor TypeScript package"
```

---

## Task 2: Utilities — expand-home and jsonl

**Files:**
- Create: `src/utils/expand-home.ts`, `src/utils/jsonl.ts`

- [ ] **Step 1: Create src/utils/expand-home.ts**

```typescript
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export function expandHome(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return resolve(p)
}
```

- [ ] **Step 2: Create src/utils/jsonl.ts**

```typescript
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function* findJsonlFiles(dir: string, since?: Date): Generator<string> {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) {
      yield* findJsonlFiles(path, since)
    } else if (item.isFile() && item.name.endsWith('.jsonl')) {
      if (!since || statSync(path).mtime >= since) yield path
    }
  }
}

export function readJsonlLines(file: string): unknown[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        return []
      }
    })
}

export function isRecentEntry(entry: unknown, since: Date): boolean {
  if (typeof entry !== 'object' || entry === null) return true
  const e = entry as Record<string, unknown>
  if (typeof e['timestamp'] === 'string') {
    const d = new Date(e['timestamp'])
    return Number.isNaN(d.getTime()) || d >= since
  }
  if (typeof e['ts'] === 'number') return new Date(e['ts'] * 1000) >= since
  return true
}
```

- [ ] **Step 3: Commit**

```sh
git add src/utils/
git commit -m "feat: add expand-home and jsonl utilities"
```

---

## Task 3: Utility — period

**Files:**
- Create: `src/utils/period.ts`, `src/utils/period.test.ts`

- [ ] **Step 1: Write the failing test — src/utils/period.test.ts**

```typescript
import { describe, expect, it } from 'vitest'
import { parsePeriod, periodToDate } from './period'

describe('parsePeriod', () => {
  it('parses days', () => expect(parsePeriod('7d')).toBe(7))
  it('parses weeks', () => expect(parsePeriod('2w')).toBe(14))
  it('parses months', () => expect(parsePeriod('1m')).toBe(30))
  it('parses years', () => expect(parsePeriod('1y')).toBe(365))
  it('throws on invalid format', () => expect(() => parsePeriod('foo')).toThrow('Invalid period'))
  it('throws on unknown unit', () => expect(() => parsePeriod('5x')).toThrow('Invalid period'))
})

describe('periodToDate', () => {
  it('returns a Date in the past', () => {
    const d = periodToDate('7d')
    expect(d.getTime()).toBeLessThan(Date.now())
    expect(d.getTime()).toBeGreaterThan(Date.now() - 8 * 24 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test -- period
```

Expected: FAIL — `Cannot find module './period'`

- [ ] **Step 3: Create src/utils/period.ts**

```typescript
const UNITS: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 }
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)([dwmy])$/)
  if (!match) throw new Error(`Invalid period: "${period}". Use values like 7d, 2w, 1m, 1y.`)
  return Number(match[1]) * UNITS[match[2]!]!
}

export function periodToDate(period: string): Date {
  return new Date(Date.now() - parsePeriod(period) * MS_PER_DAY)
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
bun run test -- period
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```sh
git add src/utils/period.ts src/utils/period.test.ts
git commit -m "feat: add period utility with tests"
```

---

## Task 4: Extractor — attributed

**Files:**
- Create: `src/extractors/attributed.ts`, `src/extractors/attributed.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/extractors/attributed.test.ts
import { describe, expect, it } from 'vitest'
import { extractAttributed } from './attributed'

describe('extractAttributed', () => {
  it('returns skill from attributionSkill field', () => {
    expect(extractAttributed({ attributionSkill: 'brainstorming' })).toEqual(['brainstorming'])
  })
  it('returns empty when field is missing', () => {
    expect(extractAttributed({ type: 'user', content: [] })).toEqual([])
  })
  it('returns empty when field is not a string', () => {
    expect(extractAttributed({ attributionSkill: 42 })).toEqual([])
  })
  it('returns empty for null', () => expect(extractAttributed(null)).toEqual([]))
  it('returns empty for primitive', () => expect(extractAttributed('text')).toEqual([]))
  it('returns empty for array', () => expect(extractAttributed([])).toEqual([]))
})
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test -- attributed
```

Expected: FAIL

- [ ] **Step 3: Create src/extractors/attributed.ts**

```typescript
export function extractAttributed(entry: unknown): string[] {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
  const skill = (entry as Record<string, unknown>)['attributionSkill']
  return typeof skill === 'string' ? [skill] : []
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
bun run test -- attributed
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```sh
git add src/extractors/attributed.ts src/extractors/attributed.test.ts
git commit -m "feat: add attributed extractor with tests"
```

---

## Task 5: Extractor — activations

**Files:**
- Create: `src/extractors/activations.ts`, `src/extractors/activations.test.ts`

Two functions:
- `extractClaudeActivations(entry)` — finds `{type:"tool_use", name:"Skill", input:{skill:"..."}}` nodes anywhere in the entry tree
- `extractCodexActivations(entry)` — finds exec_command_end paths ending in `/SKILL.md` and response_item `<skill><name>…</name></skill>` injections

- [ ] **Step 1: Write the failing test**

```typescript
// src/extractors/activations.test.ts
import { describe, expect, it } from 'vitest'
import { extractClaudeActivations, extractCodexActivations } from './activations'

describe('extractClaudeActivations', () => {
  it('finds Skill tool_use in message content', () => {
    const entry = {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'brainstorming' } }],
      },
    }
    expect(extractClaudeActivations(entry)).toEqual(['brainstorming'])
  })

  it('finds multiple Skill invocations', () => {
    const entry = {
      content: [
        { type: 'tool_use', name: 'Skill', input: { skill: 'foo' } },
        { type: 'tool_use', name: 'Skill', input: { skill: 'bar' } },
      ],
    }
    expect(extractClaudeActivations(entry)).toEqual(['foo', 'bar'])
  })

  it('ignores non-Skill tool_use nodes', () => {
    const entry = { type: 'tool_use', name: 'Bash', input: { command: 'ls' } }
    expect(extractClaudeActivations(entry)).toEqual([])
  })

  it('returns empty for unrelated entries', () => {
    expect(extractClaudeActivations({ attributionSkill: 'x' })).toEqual([])
  })
})

describe('extractCodexActivations', () => {
  it('finds skill from exec_command_end SKILL.md path', () => {
    const entry = {
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        parsed_cmd: [{ path: '/home/user/.agents/skills/brainstorming/SKILL.md' }],
      },
    }
    expect(extractCodexActivations(entry)).toEqual(['brainstorming'])
  })

  it('finds injected skill from response_item XML', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '<skill>\n<name>writing-plans</name>\n</skill>' }],
      },
    }
    expect(extractCodexActivations(entry)).toEqual(['writing-plans'])
  })

  it('ignores non-SKILL.md paths', () => {
    const entry = {
      type: 'event_msg',
      payload: { type: 'exec_command_end', parsed_cmd: [{ path: '/home/user/foo.md' }] },
    }
    expect(extractCodexActivations(entry)).toEqual([])
  })

  it('returns empty for unrelated entries', () => {
    expect(extractCodexActivations({ type: 'other' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test -- activations
```

Expected: FAIL

- [ ] **Step 3: Create src/extractors/activations.ts**

```typescript
function walk(value: unknown, visit: (node: unknown) => void): void {
  visit(value)
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, visit)
  }
}

export function extractClaudeActivations(entry: unknown): string[] {
  const skills: string[] = []
  walk(entry, (node) => {
    if (typeof node !== 'object' || node === null) return
    const n = node as Record<string, unknown>
    if (n['type'] === 'tool_use' && n['name'] === 'Skill' && typeof n['input'] === 'object') {
      const skill = (n['input'] as Record<string, unknown>)['skill']
      if (typeof skill === 'string') skills.push(skill)
    }
  })
  return skills
}

function skillNameFromPath(p: string): string | null {
  const parts = p.replace('/SKILL.md', '').split('/')
  return parts[parts.length - 1] ?? null
}

export function extractCodexActivations(entry: unknown): string[] {
  if (typeof entry !== 'object' || entry === null) return []
  const e = entry as Record<string, unknown>
  const payload = e['payload'] as Record<string, unknown> | undefined

  if (e['type'] === 'response_item' && payload?.['type'] === 'message' && payload?.['role'] === 'user') {
    const skills = new Set<string>()
    const content = (payload?.['content'] as unknown[] | undefined) ?? []
    for (const item of content) {
      const i = item as Record<string, unknown>
      if (i['type'] === 'input_text' && typeof i['text'] === 'string') {
        for (const m of i['text'].matchAll(/<skill>\s*<name>([^<]+)<\/name>/g)) {
          skills.add(m[1]!)
        }
      }
    }
    return [...skills]
  }

  if (e['type'] === 'event_msg' && payload?.['type'] === 'exec_command_end') {
    const cmds = (payload?.['parsed_cmd'] as Array<Record<string, unknown>> | undefined) ?? []
    const paths = new Set<string>()
    for (const cmd of cmds) {
      if (typeof cmd['path'] === 'string' && cmd['path'].endsWith('/SKILL.md')) {
        paths.add(cmd['path'])
      }
    }
    return [...paths].map(skillNameFromPath).filter((s): s is string => s !== null)
  }

  return []
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
bun run test -- activations
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```sh
git add src/extractors/activations.ts src/extractors/activations.test.ts
git commit -m "feat: add activations extractor for Claude and Codex with tests"
```

---

## Task 6: Extractor — mentions

**Files:**
- Create: `src/extractors/mentions.ts`, `src/extractors/mentions.test.ts`

Two functions:
- `extractClaudeMentions(entry)` — `foo/SKILL.md` paths and `superpowers:name` tokens
- `extractCodexMentions(entry)` — `/foo/SKILL.md` paths and `$skill-name` tokens

- [ ] **Step 1: Write the failing test**

```typescript
// src/extractors/mentions.test.ts
import { describe, expect, it } from 'vitest'
import { extractClaudeMentions, extractCodexMentions } from './mentions'

describe('extractClaudeMentions', () => {
  it('finds SKILL.md path in string values', () => {
    const entry = { content: 'loading brainstorming/SKILL.md for context' }
    expect(extractClaudeMentions(entry)).toContain('brainstorming')
  })

  it('finds superpowers: tokens', () => {
    const entry = { content: 'superpowers:writing-plans is active' }
    expect(extractClaudeMentions(entry)).toContain('superpowers:writing-plans')
  })

  it('deduplicates within an entry', () => {
    const entry = { a: 'brainstorming/SKILL.md', b: 'brainstorming/SKILL.md' }
    expect(extractClaudeMentions(entry)).toEqual(['brainstorming'])
  })

  it('returns empty for entries with no skill references', () => {
    expect(extractClaudeMentions({ type: 'user', content: 'hello' })).toEqual([])
  })
})

describe('extractCodexMentions', () => {
  it('finds SKILL.md path from history entry', () => {
    const entry = { text: 'read /home/user/.agents/skills/brainstorming/SKILL.md' }
    expect(extractCodexMentions(entry)).toContain('brainstorming')
  })

  it('finds $skill-name tokens', () => {
    const entry = { text: 'using $writing-plans skill' }
    expect(extractCodexMentions(entry)).toContain('writing-plans')
  })

  it('returns empty for unrelated text', () => {
    expect(extractCodexMentions({ text: 'hello world' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test -- mentions
```

Expected: FAIL

- [ ] **Step 3: Create src/extractors/mentions.ts**

```typescript
function walk(value: unknown, visit: (node: unknown) => void): void {
  visit(value)
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, visit)
  }
}

export function extractClaudeMentions(entry: unknown): string[] {
  const seen = new Set<string>()
  walk(entry, (node) => {
    if (typeof node !== 'string') return
    for (const m of node.matchAll(/(?:^|[":\s])((?:[a-z0-9-]+:)?[a-z0-9][a-z0-9-]{1,})\/SKILL\.md\b/g)) {
      seen.add(m[1]!)
    }
    for (const m of node.matchAll(/\bsuperpowers:([a-z0-9-]+)\b/g)) {
      seen.add(`superpowers:${m[1]!}`)
    }
  })
  return [...seen]
}

export function extractCodexMentions(entry: unknown): string[] {
  const seen = new Set<string>()
  walk(entry, (node) => {
    if (typeof node !== 'string') return
    for (const m of node.matchAll(/\/([^/)\]\s]+)\/SKILL\.md\b/g)) {
      seen.add(m[1]!)
    }
    for (const m of node.matchAll(/\$([a-z0-9][a-z0-9-]{1,})\b/g)) {
      seen.add(m[1]!)
    }
  })
  return [...seen]
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
bun run test -- mentions
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```sh
git add src/extractors/mentions.ts src/extractors/mentions.test.ts
git commit -m "feat: add mentions extractor for Claude and Codex with tests"
```

---

## Task 7: Lock File Module

**Files:**
- Create: `src/lock/file.ts`, `src/lock/file.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lock/file.test.ts
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getLockPath, readLock, removeSkillFromLock, writeLock } from './file'

const TMP = join(tmpdir(), `skvisor-lock-${Date.now()}`)

beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

describe('readLock', () => {
  it('returns empty skills when file does not exist', () => {
    expect(readLock(join(TMP, 'missing.json'))).toEqual({ skills: {} })
  })
  it('reads an existing lock file', () => {
    const path = join(TMP, 'lock.json')
    writeLock(path, { skills: { brainstorming: {} } })
    expect(readLock(path)).toEqual({ skills: { brainstorming: {} } })
  })
})

describe('writeLock', () => {
  it('writes and reads back correctly', () => {
    const path = join(TMP, 'lock.json')
    writeLock(path, { skills: { foo: {}, bar: {} } })
    expect(readLock(path).skills).toHaveProperty('foo')
    expect(readLock(path).skills).toHaveProperty('bar')
  })
})

describe('removeSkillFromLock', () => {
  it('removes a skill and creates a backup', () => {
    const path = join(TMP, 'lock.json')
    writeLock(path, { skills: { brainstorming: {}, 'writing-plans': {} } })
    const result = removeSkillFromLock(path, 'brainstorming')
    expect(result.removed).toBe(true)
    expect(result.backupPath).toBeDefined()
    expect(existsSync(result.backupPath!)).toBe(true)
    expect(readLock(path).skills).not.toHaveProperty('brainstorming')
    expect(readLock(path).skills).toHaveProperty('writing-plans')
  })
  it('returns removed: false when skill is absent', () => {
    const path = join(TMP, 'lock.json')
    writeLock(path, { skills: {} })
    expect(removeSkillFromLock(path, 'nonexistent').removed).toBe(false)
  })
  it('returns removed: false when file does not exist', () => {
    expect(removeSkillFromLock(join(TMP, 'missing.json'), 'foo').removed).toBe(false)
  })
})

describe('getLockPath', () => {
  it('returns skills-lock.json for local scope', () => {
    expect(getLockPath(false)).toBe('skills-lock.json')
  })
  it('contains .agents and .skill-lock.json for global scope', () => {
    const p = getLockPath(true)
    expect(p).toContain('.agents')
    expect(p).toContain('.skill-lock.json')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test -- lock
```

Expected: FAIL

- [ ] **Step 3: Create src/lock/file.ts**

```typescript
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export interface LockFile {
  skills: Record<string, unknown>
}

export function getLockPath(global: boolean): string {
  return global ? join(homedir(), '.agents', '.skill-lock.json') : 'skills-lock.json'
}

export function readLock(path: string): LockFile {
  if (!existsSync(path)) return { skills: {} }
  return JSON.parse(readFileSync(path, 'utf8')) as LockFile
}

export function writeLock(path: string, lock: LockFile): void {
  const tmp = join(dirname(path), `.${Date.now()}.skill-lock.json`)
  writeFileSync(tmp, `${JSON.stringify(lock, null, 2)}\n`)
  renameSync(tmp, path)
}

export function removeSkillFromLock(
  path: string,
  skill: string,
): { removed: boolean; backupPath?: string } {
  if (!existsSync(path)) return { removed: false }
  const lock = readLock(path)
  if (!Object.hasOwn(lock.skills, skill)) return { removed: false }
  const backupPath = `${path}.bak`
  copyFileSync(path, backupPath)
  delete lock.skills[skill]
  writeLock(path, lock)
  return { removed: true, backupPath }
}
```

- [ ] **Step 4: Run test to verify it passes**

```sh
bun run test -- lock
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```sh
git add src/lock/file.ts src/lock/file.test.ts
git commit -m "feat: add lock file module with atomic write and tests"
```

---

## Task 8: Readers

**Files:**
- Create: `src/readers/claude.ts`, `src/readers/codex.ts`

- [ ] **Step 1: Create src/readers/claude.ts**

```typescript
import { readFileSync } from 'node:fs'
import { extractAttributed } from '../extractors/attributed'
import { extractClaudeActivations } from '../extractors/activations'
import { extractClaudeMentions } from '../extractors/mentions'
import { expandHome } from '../utils/expand-home'
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl'

export type ClaudeMode = 'attributed' | 'activations' | 'mentions'

export interface ClaudeReaderOptions {
  since: Date
  mode: ClaudeMode
  root?: string
  scanAllFiles?: boolean
}

export interface UsageResult {
  counts: Map<string, number>
  filesRead: number
  linesRead: number
}

function extractSkills(entry: unknown, mode: ClaudeMode): string[] {
  if (mode === 'attributed') return extractAttributed(entry)
  if (mode === 'activations') return extractClaudeActivations(entry)
  return extractClaudeMentions(entry)
}

export function readClaudeUsage(options: ClaudeReaderOptions): UsageResult {
  const root = expandHome(options.root ?? '~/.claude/projects')
  const counts = new Map<string, number>()
  let filesRead = 0
  let linesRead = 0
  const since = options.scanAllFiles ? undefined : options.since

  for (const file of findJsonlFiles(root, since)) {
    filesRead++
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      linesRead++
      let entry: unknown
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      if (!isRecentEntry(entry, options.since)) continue
      for (const skill of extractSkills(entry, options.mode)) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1)
      }
    }
  }

  return { counts, filesRead, linesRead }
}
```

- [ ] **Step 2: Create src/readers/codex.ts**

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { extractCodexActivations } from '../extractors/activations'
import { extractCodexMentions } from '../extractors/mentions'
import { expandHome } from '../utils/expand-home'
import { findJsonlFiles, isRecentEntry } from '../utils/jsonl'
import type { UsageResult } from './claude'

export type CodexMode = 'activations' | 'mentions'

export interface CodexReaderOptions {
  since: Date
  mode: CodexMode
  root?: string
  history?: string
  scanAllFiles?: boolean
}

export function readCodexUsage(options: CodexReaderOptions): UsageResult {
  return options.mode === 'mentions'
    ? readCodexMentions(options)
    : readCodexActivations(options)
}

function readCodexActivations(options: CodexReaderOptions): UsageResult {
  const root = expandHome(options.root ?? '~/.codex/sessions')
  const counts = new Map<string, number>()
  let filesRead = 0
  let linesRead = 0
  const since = options.scanAllFiles ? undefined : options.since

  for (const file of findJsonlFiles(root, since)) {
    filesRead++
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      linesRead++
      let entry: unknown
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      if (!isRecentEntry(entry, options.since)) continue
      for (const skill of extractCodexActivations(entry)) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1)
      }
    }
  }

  return { counts, filesRead, linesRead }
}

function readCodexMentions(options: CodexReaderOptions): UsageResult {
  const historyPath = expandHome(options.history ?? '~/.codex/history.jsonl')
  const counts = new Map<string, number>()
  let linesRead = 0

  if (!existsSync(historyPath)) return { counts, filesRead: 0, linesRead: 0 }

  for (const line of readFileSync(historyPath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    linesRead++
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (!isRecentEntry(entry, options.since)) continue
    for (const skill of extractCodexMentions(entry)) {
      counts.set(skill, (counts.get(skill) ?? 0) + 1)
    }
  }

  return { counts, filesRead: 1, linesRead }
}
```

- [ ] **Step 3: Commit**

```sh
git add src/readers/
git commit -m "feat: add Claude and Codex readers"
```

---

## Task 9: Commands

**Files:**
- Create: `src/commands/audit.ts`, `src/commands/list.ts`, `src/commands/remove.ts`

- [ ] **Step 1: Create src/commands/audit.ts**

```typescript
import { defineCommand } from 'citty'
import { readClaudeUsage, type ClaudeMode } from '../readers/claude'
import { readCodexUsage, type CodexMode } from '../readers/codex'
import { parsePeriod } from '../utils/period'

type Agent = 'claude' | 'codex'

export interface AuditArgs {
  agent?: string
  period: string
  since?: string
  mode?: string
  format: string
  root?: string
  'scan-all-files': boolean
}

function parseAgents(agent: string | undefined): Agent[] {
  if (!agent) throw new Error('--agent is required. Use --agent claude, --agent codex, or both.')
  const normalized = agent
    .split(',')
    .map((a) => a.trim())
    .map((a): Agent => {
      if (a === 'codex') return 'codex'
      if (['claude', 'claude-code', 'claudecode'].includes(a)) return 'claude'
      throw new Error(`Unknown agent: "${a}". Use "claude" or "codex".`)
    })
  return [...new Set(normalized)]
}

function toRows(counts: Map<string, number>): Array<{ skill: string; count: number }> {
  return [...counts.entries()]
    .sort(([sa, ca], [sb, cb]) => cb - ca || sa.localeCompare(sb))
    .map(([skill, count]) => ({ skill, count }))
}

export async function runAudit(args: AuditArgs): Promise<void> {
  const agents = parseAgents(args.agent)
  const since = args.since
    ? new Date(`${args.since}T00:00:00`)
    : new Date(Date.now() - parsePeriod(args.period) * 24 * 60 * 60 * 1000)

  if (Number.isNaN(since.getTime())) {
    console.error(`Invalid --since value: ${args.since}`)
    process.exit(1)
  }

  const results: Array<{ agent: Agent; mode: string; rows: ReturnType<typeof toRows>; stats: { filesRead: number; linesRead: number } }> = []

  for (const agent of agents) {
    if (agent === 'claude') {
      const mode = (args.mode ?? 'attributed') as ClaudeMode
      const result = readClaudeUsage({ since, mode, root: args.root, scanAllFiles: args['scan-all-files'] })
      results.push({ agent, mode, rows: toRows(result.counts), stats: { filesRead: result.filesRead, linesRead: result.linesRead } })
    } else {
      const mode = (args.mode ?? 'activations') as CodexMode
      const result = readCodexUsage({ since, mode, root: args.root, scanAllFiles: args['scan-all-files'] })
      results.push({ agent, mode, rows: toRows(result.counts), stats: { filesRead: result.filesRead, linesRead: result.linesRead } })
    }
  }

  if (args.format === 'json') {
    const output = results.map(({ agent, mode, rows }) => ({ agent, mode, since: since.toISOString(), skills: rows }))
    console.log(JSON.stringify(output.length === 1 ? output[0] : output, null, 2))
    return
  }

  for (const { agent, mode, rows, stats } of results) {
    console.log(`\n${agent} skill usage since ${since.toISOString().slice(0, 10)} (${mode})`)
    console.log(`Files read: ${stats.filesRead}; JSONL lines read: ${stats.linesRead}`)
    if (rows.length === 0) {
      console.log('No skills found.')
    } else {
      const maxLen = Math.max(...rows.map((r) => String(r.count).length))
      for (const r of rows) console.log(`${String(r.count).padStart(maxLen)} ${r.skill}`)
    }
  }
}

export const auditCommand = defineCommand({
  meta: { description: 'Audit skill usage from agent session logs' },
  args: {
    agent: { type: 'string', alias: 'a', description: 'claude, codex, or comma-separated' },
    period: { type: 'string', alias: 'p', default: '7d', description: '7d, 2w, 1m, 1y' },
    since: { type: 'string', description: 'yyyy-mm-dd, overrides --period' },
    mode: { type: 'string', description: 'attributed | activations | mentions' },
    format: { type: 'string', default: 'text', description: 'text | json' },
    root: { type: 'string', description: 'Override agent sessions directory' },
    'scan-all-files': { type: 'boolean', default: false, description: 'Ignore file mtime' },
  },
  async run({ args }) {
    await runAudit(args as AuditArgs)
  },
})
```

- [ ] **Step 2: Create src/commands/list.ts**

```typescript
import { defineCommand } from 'citty'
import { getLockPath, readLock } from '../lock/file'

export const listCommand = defineCommand({
  meta: { description: 'List skills in the lock file' },
  args: {
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
  },
  run({ args }) {
    const path = getLockPath(args.global)
    const lock = readLock(path)
    const skills = Object.keys(lock.skills).sort()
    console.log(JSON.stringify(skills, null, 2))
  },
})
```

- [ ] **Step 3: Create src/commands/remove.ts**

```typescript
import { defineCommand } from 'citty'
import { getLockPath, readLock, removeSkillFromLock } from '../lock/file'

export const removeCommand = defineCommand({
  meta: { description: 'Remove a skill from the lock file' },
  args: {
    skill: { type: 'positional', description: 'Skill name to remove', required: true },
    global: { type: 'boolean', alias: 'g', default: false, description: 'Use global lock file' },
    'dry-run': { type: 'boolean', default: false, description: 'Print without making changes' },
  },
  run({ args }) {
    const { skill, global: isGlobal, 'dry-run': dryRun } = args
    const path = getLockPath(isGlobal)

    if (dryRun) {
      console.log(`Would remove "${skill}" from ${path}`)
      return
    }

    const result = removeSkillFromLock(path, skill)

    if (result.removed) {
      console.log(`Removed "${skill}" from ${path}`)
      if (result.backupPath) console.log(`Backup: ${result.backupPath}`)
    } else {
      console.log(`"${skill}" is not in ${path}`)
    }

    const updated = readLock(path)
    console.log(JSON.stringify(Object.keys(updated.skills).sort(), null, 2))
  },
})
```

- [ ] **Step 4: Commit**

```sh
git add src/commands/
git commit -m "feat: add audit, list, and remove commands"
```

---

## Task 10: Entry Points

**Files:**
- Create: `src/cli.ts`, `src/index.ts`

- [ ] **Step 1: Create src/cli.ts**

The shebang on the first line is required — bunup/esbuild preserves it.

```typescript
#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { auditCommand, runAudit } from './commands/audit'
import { listCommand } from './commands/list'
import { removeCommand } from './commands/remove'

const main = defineCommand({
  meta: {
    name: 'skvisor',
    version: '0.1.0',
    description: 'Audit and manage AI agent skills',
  },
  subCommands: {
    audit: auditCommand,
    list: listCommand,
    ls: listCommand,
    remove: removeCommand,
    rm: removeCommand,
  },
  args: {
    agent: { type: 'string', alias: 'a', description: 'Agent(s): claude, codex' },
    period: { type: 'string', alias: 'p', default: '7d', description: '7d, 2w, 1m, 1y' },
    since: { type: 'string', description: 'yyyy-mm-dd' },
    mode: { type: 'string', description: 'attributed | activations | mentions' },
    format: { type: 'string', default: 'text', description: 'text | json' },
    root: { type: 'string', description: 'Override sessions directory' },
    'scan-all-files': { type: 'boolean', default: false },
  },
  async run({ args }) {
    await runAudit(args as Parameters<typeof runAudit>[0])
  },
})

runMain(main)
```

- [ ] **Step 2: Create src/index.ts**

```typescript
export { extractAttributed } from './extractors/attributed'
export { extractClaudeActivations, extractCodexActivations } from './extractors/activations'
export { extractClaudeMentions, extractCodexMentions } from './extractors/mentions'
export { readClaudeUsage } from './readers/claude'
export { readCodexUsage } from './readers/codex'
export { readLock, writeLock, removeSkillFromLock, getLockPath } from './lock/file'
export { parsePeriod, periodToDate } from './utils/period'
export type { LockFile } from './lock/file'
export type { ClaudeReaderOptions, CodexReaderOptions, UsageResult } from './readers/claude'
```

Wait — `UsageResult` and `CodexReaderOptions` are in different files. Fix the export:

```typescript
export { extractAttributed } from './extractors/attributed'
export { extractClaudeActivations, extractCodexActivations } from './extractors/activations'
export { extractClaudeMentions, extractCodexMentions } from './extractors/mentions'
export { readClaudeUsage, type ClaudeReaderOptions, type UsageResult } from './readers/claude'
export { readCodexUsage, type CodexReaderOptions } from './readers/codex'
export { readLock, writeLock, removeSkillFromLock, getLockPath, type LockFile } from './lock/file'
export { parsePeriod, periodToDate } from './utils/period'
```

- [ ] **Step 3: Verify lint passes**

```sh
bun run lint
```

Fix any Biome warnings before continuing.

- [ ] **Step 4: Commit**

```sh
git add src/cli.ts src/index.ts
git commit -m "feat: add CLI entry point and public API index"
```

---

## Task 11: Test Fixtures

**Files:**
- Create: `test/fixtures/claude/sample.jsonl`, `test/fixtures/codex/sample.jsonl`, `test/fixtures/lock/skills-lock.json`

- [ ] **Step 1: Create directory structure**

```sh
mkdir -p test/fixtures/claude test/fixtures/codex test/fixtures/lock
```

- [ ] **Step 2: Create test/fixtures/claude/sample.jsonl**

Each line is a JSON object. This file covers all three Claude modes.

```jsonl
{"timestamp":"2026-05-06T10:00:00Z","attributionSkill":"brainstorming","type":"summary"}
{"timestamp":"2026-05-06T11:00:00Z","attributionSkill":"writing-plans","type":"summary"}
{"timestamp":"2026-05-06T12:00:00Z","attributionSkill":"brainstorming","type":"summary"}
{"timestamp":"2026-05-06T10:00:00Z","type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"simplify"}}]}}
{"timestamp":"2026-05-06T10:00:00Z","type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"brainstorming"}}]}}
{"timestamp":"2026-05-06T10:00:00Z","type":"system","content":"loading brainstorming/SKILL.md for context"}
{"timestamp":"2026-05-06T10:00:00Z","type":"system","content":"superpowers:writing-plans is active now"}
{"timestamp":"2020-01-01T00:00:00Z","attributionSkill":"old-skill","type":"summary"}
```

- [ ] **Step 3: Create test/fixtures/codex/sample.jsonl**

```jsonl
{"type":"event_msg","ts":1746518400,"payload":{"type":"exec_command_end","parsed_cmd":[{"path":"/home/user/.agents/skills/brainstorming/SKILL.md"}]}}
{"type":"response_item","ts":1746518401,"payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<skill>\n<name>writing-plans</name>\n</skill>"}]}}
{"type":"event_msg","ts":1746518402,"payload":{"type":"exec_command_end","parsed_cmd":[{"path":"/home/user/.agents/skills/brainstorming/SKILL.md"}]}}
{"type":"event_msg","ts":1000000,"payload":{"type":"exec_command_end","parsed_cmd":[{"path":"/skills/old-skill/SKILL.md"}]}}
```

Note: `ts:1746518400` = 2026-05-06, `ts:1000000` = 1970 (gets filtered by date).

- [ ] **Step 4: Create test/fixtures/lock/skills-lock.json**

```json
{
  "skills": {
    "brainstorming": {},
    "writing-plans": {},
    "frontend-design": {}
  }
}
```

- [ ] **Step 5: Commit**

```sh
git add test/fixtures/
git commit -m "test: add JSONL and lock fixtures"
```

---

## Task 12: e2e Tests

**Files:**
- Create: `test/e2e/helpers.ts`, `test/e2e/audit-claude.test.ts`, `test/e2e/audit-codex.test.ts`, `test/e2e/list.test.ts`, `test/e2e/remove.test.ts`

These tests run `dist/cli.js` as a subprocess — run `bun run build` before running these.

- [ ] **Step 1: Create test/e2e/helpers.ts**

```typescript
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const CLI = join(process.cwd(), 'dist', 'cli.js')

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export function run(args: string[], cwd?: string): RunResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: cwd ?? process.cwd(),
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}
```

- [ ] **Step 2: Create test/e2e/audit-claude.test.ts**

```typescript
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from './helpers'

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'claude')

describe('skvisor audit claude', () => {
  it('counts attributed skills from fixtures', () => {
    const { stdout, exitCode } = run([
      '--agent', 'claude',
      '--mode', 'attributed',
      '--root', FIXTURES,
      '--scan-all-files',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('brainstorming')
    expect(stdout).toContain('writing-plans')
    // brainstorming appears twice in fixture
    expect(stdout).toMatch(/2\s+brainstorming/)
    expect(stdout).toMatch(/1\s+writing-plans/)
  })

  it('counts activations mode', () => {
    const { stdout, exitCode } = run([
      '--agent', 'claude',
      '--mode', 'activations',
      '--root', FIXTURES,
      '--scan-all-files',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('simplify')
    expect(stdout).toContain('brainstorming')
  })

  it('outputs valid JSON with --format json', () => {
    const { stdout, exitCode } = run([
      '--agent', 'claude',
      '--mode', 'attributed',
      '--root', FIXTURES,
      '--scan-all-files',
      '--format', 'json',
    ])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as { agent: string; skills: Array<{ skill: string; count: number }> }
    expect(parsed.agent).toBe('claude')
    expect(parsed.skills[0]?.skill).toBe('brainstorming')
    expect(parsed.skills[0]?.count).toBe(2)
  })

  it('exits non-zero when --agent is missing', () => {
    const { exitCode } = run(['--root', FIXTURES])
    expect(exitCode).not.toBe(0)
  })

  it('filters out old entries by default', () => {
    const { stdout, exitCode } = run([
      '--agent', 'claude',
      '--mode', 'attributed',
      '--root', FIXTURES,
      '--period', '7d',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).not.toContain('old-skill')
  })
})
```

- [ ] **Step 3: Create test/e2e/audit-codex.test.ts**

```typescript
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from './helpers'

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'codex')

describe('skvisor audit codex', () => {
  it('counts activations from exec_command_end entries', () => {
    const { stdout, exitCode } = run([
      '--agent', 'codex',
      '--mode', 'activations',
      '--root', FIXTURES,
      '--scan-all-files',
    ])
    expect(exitCode).toBe(0)
    // brainstorming appears twice (two exec_command_end + one response_item for writing-plans)
    expect(stdout).toContain('brainstorming')
    expect(stdout).toContain('writing-plans')
    expect(stdout).toMatch(/2\s+brainstorming/)
  })

  it('outputs valid JSON', () => {
    const { stdout, exitCode } = run([
      '--agent', 'codex',
      '--mode', 'activations',
      '--root', FIXTURES,
      '--scan-all-files',
      '--format', 'json',
    ])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as { agent: string; skills: unknown[] }
    expect(parsed.agent).toBe('codex')
    expect(parsed.skills.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Create test/e2e/list.test.ts**

```typescript
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from './helpers'

const LOCK_DIR = join(process.cwd(), 'test', 'fixtures', 'lock')

describe('skvisor list', () => {
  it('lists skills from skills-lock.json in cwd', () => {
    const { stdout, exitCode } = run(['list'], LOCK_DIR)
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as string[]
    expect(parsed).toContain('brainstorming')
    expect(parsed).toContain('writing-plans')
    expect(parsed).toContain('frontend-design')
  })

  it('ls alias works the same as list', () => {
    const { stdout, exitCode } = run(['ls'], LOCK_DIR)
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout) as string[]
    expect(parsed.length).toBe(3)
  })
})
```

- [ ] **Step 5: Create test/e2e/remove.test.ts**

```typescript
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run } from './helpers'

const LOCK_FIXTURE = join(process.cwd(), 'test', 'fixtures', 'lock', 'skills-lock.json')

let TMP = ''

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'skvisor-e2e-'))
  cpSync(LOCK_FIXTURE, join(TMP, 'skills-lock.json'))
})

afterEach(() => rmSync(TMP, { recursive: true, force: true }))

describe('skvisor remove', () => {
  it('removes a skill and prints the updated list', () => {
    const { stdout, exitCode } = run(['remove', 'brainstorming'], TMP)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Removed "brainstorming"')
    const match = stdout.match(/\[[\s\S]*\]/)
    const skills = JSON.parse(match![0]!) as string[]
    expect(skills).not.toContain('brainstorming')
    expect(skills).toContain('writing-plans')
  })

  it('rm alias works', () => {
    const { stdout, exitCode } = run(['rm', 'frontend-design'], TMP)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Removed "frontend-design"')
  })

  it('reports when skill is not in lock', () => {
    const { stdout, exitCode } = run(['remove', 'nonexistent'], TMP)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('not in')
  })

  it('--dry-run prints without modifying the file', () => {
    const { stdout, exitCode } = run(['remove', '--dry-run', 'brainstorming'], TMP)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Would remove')
    // Re-list: brainstorming should still be there
    const { stdout: listOut } = run(['list'], TMP)
    expect(JSON.parse(listOut) as string[]).toContain('brainstorming')
  })
})
```

- [ ] **Step 6: Commit**

```sh
git add test/e2e/
git commit -m "test: add e2e tests for audit, list, and remove"
```

---

## Task 13: Build and Verify

- [ ] **Step 1: Run unit tests**

```sh
bun run test
```

Expected: all unit tests PASS (period, attributed, activations, mentions, lock/file).

- [ ] **Step 2: Build**

```sh
bun run build
```

Expected: `dist/` created with `cli.js`, `index.js`, `index.cjs`, `index.d.ts`.

- [ ] **Step 3: Verify shebang in dist/cli.js**

```sh
head -1 dist/cli.js
```

Expected: `#!/usr/bin/env node`

If missing, add it manually:

```sh
echo '#!/usr/bin/env node' | cat - dist/cli.js > /tmp/cli.js && mv /tmp/cli.js dist/cli.js
chmod +x dist/cli.js
```

- [ ] **Step 4: Verify CLI works directly**

```sh
node dist/cli.js --help
node dist/cli.js --agent claude --period 7d
```

Expected: help text printed, then audit runs (may show "No skills found" if no Claude logs exist locally — that's fine).

- [ ] **Step 5: Run e2e tests**

```sh
bun run test:e2e
```

Expected: all e2e tests PASS.

- [ ] **Step 6: Run lint**

```sh
bun run lint
```

Fix any Biome errors. Common fixes:
- `biome check --write src/` to auto-fix formatting

- [ ] **Step 7: Commit dist (optional — usually gitignored)**

Add `dist/` to `.gitignore` if not already there:

```sh
echo 'dist/' >> .gitignore
git add .gitignore
git commit -m "chore: ignore dist/ from git"
```

---

## Task 14: Changesets and README

**Files:**
- Modify: `README.md`
- Create: `.changeset/config.json` (via CLI)

- [ ] **Step 1: Initialize Changesets**

```sh
bunx changeset init
```

Expected: `.changeset/` directory created with `config.json` and `README.md`.

- [ ] **Step 2: Verify .changeset/config.json**

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main"
}
```

- [ ] **Step 3: Update README.md with installation instructions**

Add at the top of README.md after the title:

```markdown
## Installation

```sh
# one-off (no install needed)
npx skvisor --agent claude --period 7d
pnpm dlx skvisor --agent codex --period 2w

# global install
npm install -g skvisor
pnpm add -g skvisor
```
```

- [ ] **Step 4: Create initial changeset**

```sh
bunx changeset
```

Select: `patch`, package `skvisor`, summary: `Initial release — CLI for auditing and managing AI agent skills`.

- [ ] **Step 5: Commit**

```sh
git add .changeset/ README.md
git commit -m "chore: init changesets and update README"
```

- [ ] **Step 6: Verify prepublishOnly passes**

```sh
bun run prepublishOnly
```

Expected: lint → test → build → test:e2e all pass without errors.

---

## Publishing (when ready)

```sh
# bump version from changeset
bunx changeset version

# publish to npm
bunx changeset publish
```

Requires `npm login` or `NPM_TOKEN` set in environment.
