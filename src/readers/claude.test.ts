import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readClaudeUsage } from './claude';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'claude-over-count');
const SAMPLE_DIR = join(process.cwd(), 'test', 'fixtures', 'claude');

describe('readClaudeUsage attributed mode (rising-edge)', () => {
  it('counts one invocation that spans 24 lines as 1', () => {
    const { counts } = readClaudeUsage({
      since: new Date(0),
      mode: 'attributed',
      root: join(FIXTURES, 'one-invocation-dir'),
      scanAllFiles: true,
    });
    expect(counts.get('skill-foo')).toBe(1);
  });

  it('counts skill that spans a no-attribution gap as 1 continuous invocation', () => {
    // [foo, foo, no-attr, foo, foo] — the gap is user-input within one active skill,
    // not an end-of-invocation. Should count as 1, not 2.
    const { counts } = readClaudeUsage({
      since: new Date(0),
      mode: 'attributed',
      root: join(FIXTURES, 'same-skill-twice-dir'),
      scanAllFiles: true,
    });
    expect(counts.get('skill-foo')).toBe(1);
  });

  it('counts two skills interleaved (foo,foo,bar,bar,foo) as foo=2 bar=1', () => {
    const { counts } = readClaudeUsage({
      since: new Date(0),
      mode: 'attributed',
      root: join(FIXTURES, 'two-skills-interleaved-dir'),
      scanAllFiles: true,
    });
    expect(counts.get('skill-foo')).toBe(2);
    expect(counts.get('skill-bar')).toBe(1);
  });
});

describe('readClaudeUsage activations mode (unchanged by rising-edge)', () => {
  it('preserves activations-mode counts on the existing sample fixture', () => {
    const { counts } = readClaudeUsage({
      since: new Date(0),
      mode: 'activations',
      root: SAMPLE_DIR,
      scanAllFiles: true,
    });
    // existing sample.jsonl has two tool_use Skill entries: skill-quux and skill-foo
    expect(counts.get('skill-quux')).toBe(1);
    expect(counts.get('skill-foo')).toBe(1);
  });
});

describe('readClaudeUsage merged mode (default for claude-code)', () => {
  it('merges attribution and tool_use:Skill signals via max per skill per session', () => {
    // Fixture sequence: foo, foo, tool_use:Skill(bar) (no attribution), qux, foo
    // - skill-foo: 2 rising edges (start, then after qux interrupts), 0 tool_use → max 2
    // - skill-qux: 1 rising edge → max 1
    // - skill-bar: 0 attribution (Claude Code did not stamp it — simulates nested Skill
    //   invocation), 1 tool_use:Skill record → max 1
    const { counts } = readClaudeUsage({
      since: new Date(0),
      mode: 'merged',
      root: join(FIXTURES, 'merged-dir'),
      scanAllFiles: true,
    });
    expect(counts.get('skill-foo')).toBe(2);
    expect(counts.get('skill-qux')).toBe(1);
    expect(counts.get('skill-bar')).toBe(1);
  });
});
