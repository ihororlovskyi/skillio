// src/utils/skill-table.test.ts
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setColorEnabled } from './ansi';
import { collectRows, renderSkillTable, type SkillRow } from './skill-table';

const ROWS: SkillRow[] = [
  { name: 'cross-review', agents: 'real', claude: 'symlink', inLock: true },
  { name: 'echarts', claude: 'real', inLock: false },
  { name: 'old-skill', inLock: true },
  { name: 'webapp-debugger', agents: 'symlink', claude: 'broken', inLock: false },
];

afterEach(() => setColorEnabled(false));

describe('renderSkillTable', () => {
  it('renders the spec table with a total row', () => {
    expect(renderSkillTable(ROWS, { lockLabel: 'skills-lock.json', total: true })).toEqual([
      'skill            .agents    .claude    skills-lock.json',
      'cross-review     universal  symlinked  +',
      'echarts          -          copied     -',
      'old-skill        -          -          +',
      'webapp-debugger  symlinked  broken     -',
      '4 skills         2          3          2',
    ]);
  });

  it('omits the total row and uses the given lock label', () => {
    const rows: SkillRow[] = [{ name: 'tdd', agents: 'symlink', claude: 'symlink', inLock: false }];
    expect(renderSkillTable(rows, { lockLabel: '.agents/.skill-lock.json', total: false })).toEqual(
      ['skill  .agents    .claude    .agents/.skill-lock.json', 'tdd    symlinked  symlinked  -'],
    );
  });

  it('says "1 skill" in the total row', () => {
    const rows: SkillRow[] = [{ name: 'a', inLock: true }];
    expect(renderSkillTable(rows, { lockLabel: 'skills-lock.json', total: true }).at(-1)).toBe(
      '1 skill  0        0        1',
    );
  });

  it('colors cells, bolds the header and keeps alignment by visible width', () => {
    setColorEnabled(true);
    const lines = renderSkillTable(ROWS, { lockLabel: 'skills-lock.json', total: false });
    expect(lines[0]).toContain('\x1b[1mskill\x1b[22m');
    expect(lines[1]).toBe('cross-review     \x1b[32muniversal\x1b[0m  \x1b[33msymlinked\x1b[0m  +');
    expect(lines[2]).toContain('\x1b[32mcopied\x1b[0m');
    expect(lines[3]).toBe('old-skill        -          -          \x1b[31m+\x1b[0m');
    expect(lines[4]).toContain('\x1b[31mbroken\x1b[0m');
  });
});

describe('collectRows', () => {
  let tmp = '';
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('reads install types from both roots, dedupes and sorts names', () => {
    tmp = mkdtempSync(join(tmpdir(), 'skl-table-'));
    const agents = join(tmp, '.agents', 'skills');
    const claude = join(tmp, '.claude', 'skills');
    mkdirSync(join(agents, 'b'), { recursive: true });
    writeFileSync(join(agents, 'b', 'SKILL.md'), '---\nname: b\n---\n');
    mkdirSync(claude, { recursive: true });
    symlinkSync('../../.agents/skills/b', join(claude, 'b'));
    symlinkSync('../../.agents/skills/gone', join(claude, 'a'));
    expect(collectRows(['b', 'a', 'b', 'c'], { agents, claude }, new Set(['c']))).toEqual([
      { name: 'a', agents: undefined, claude: 'broken', inLock: false },
      { name: 'b', agents: 'real', claude: 'symlink', inLock: false },
      { name: 'c', agents: undefined, claude: undefined, inLock: true },
    ]);
  });
});
