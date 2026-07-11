import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverSkills } from './discover-skills';

let TMP = '';

function writeSkill(root: string, sub: 'claude' | 'agents', name: string, fm: string | null) {
  const dir = join(root, sub === 'claude' ? '.claude' : '.agents', 'skills', name);
  mkdirSync(dir, { recursive: true });
  const body = fm === null ? '# no frontmatter\n' : `---\n${fm}\n---\n# body\n`;
  writeFileSync(join(dir, 'SKILL.md'), body);
}

function writeLock(root: string, names: string[]) {
  writeFileSync(
    join(root, 'skills-lock.json'),
    JSON.stringify({ skills: Object.fromEntries(names.map((n) => [n, {}])) }),
  );
}

beforeEach(() => {
  TMP = join(tmpdir(), `skl-discover-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  // best-effort cleanup
  try {
    require('node:fs').rmSync(TMP, { recursive: true, force: true });
  } catch {}
});

describe('discoverSkills (local scope)', () => {
  it('merges lock + .claude/skills + .agents/skills by name', () => {
    writeLock(TMP, ['both', 'lock-only']);
    writeSkill(TMP, 'claude', 'both', 'name: both\ndescription: x');
    writeSkill(TMP, 'claude', 'claude-only', 'name: claude-only\ndescription: y');
    writeSkill(TMP, 'agents', 'agent-only', 'name: agent-only\ndescription: z');

    const map = discoverSkills({
      isGlobal: false,
      cwd: TMP,
      lockPath: join(TMP, 'skills-lock.json'),
    });

    expect([...map.keys()].sort()).toEqual(['agent-only', 'both', 'claude-only', 'lock-only']);
    expect(map.get('both')?.sources.sort()).toEqual(['.claude', 'lock']);
    expect(map.get('lock-only')?.status).toBe('missing');
    expect(map.get('claude-only')?.status).toBe('ok');
    expect(map.get('agent-only')?.sources).toEqual(['.agents']);
  });

  it('marks no-frontmatter status', () => {
    writeLock(TMP, []);
    writeSkill(TMP, 'claude', 'plain', null);

    const map = discoverSkills({
      isGlobal: false,
      cwd: TMP,
      lockPath: join(TMP, 'skills-lock.json'),
    });

    expect(map.get('plain')?.status).toBe('no-frontmatter');
    expect(map.get('plain')?.frontmatterTokens).toBeUndefined();
  });

  it('lists a dangling symlink skill in .claude/skills', () => {
    writeLock(TMP, []);
    const claudeSkills = join(TMP, '.claude', 'skills');
    mkdirSync(claudeSkills, { recursive: true });
    // symlink whose target does not exist — SKILL.md never resolves
    symlinkSync(join(TMP, '.agents', 'skills', 'ghost'), join(claudeSkills, 'ghost'));

    const map = discoverSkills({
      isGlobal: false,
      cwd: TMP,
      lockPath: join(TMP, 'skills-lock.json'),
    });

    expect(map.get('ghost')?.sources).toEqual(['.claude']);
    expect(map.get('ghost')?.status).toBe('missing');
  });

  it('omits .agents/skills row when the directory is absent', () => {
    writeLock(TMP, []);
    writeSkill(TMP, 'claude', 'foo', 'name: foo\ndescription: x');

    const map = discoverSkills({
      isGlobal: false,
      cwd: TMP,
      lockPath: join(TMP, 'skills-lock.json'),
    });

    // nothing should mention .agents
    for (const rec of map.values()) {
      expect(rec.sources).not.toContain('.agents');
    }
  });
});
