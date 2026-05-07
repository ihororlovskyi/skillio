import { describe, expect, it } from 'vitest';
import { extractClaudeMentions, extractCodexMentions } from './mentions';

describe('extractClaudeMentions', () => {
  it('finds SKILL.md path in string values', () => {
    const entry = { content: 'loading brainstorming/SKILL.md for context' };
    expect(extractClaudeMentions(entry)).toContain('brainstorming');
  });

  it('finds superpowers: tokens', () => {
    const entry = { content: 'superpowers:writing-plans is active' };
    expect(extractClaudeMentions(entry)).toContain('superpowers:writing-plans');
  });

  it('deduplicates within an entry', () => {
    const entry = { a: 'brainstorming/SKILL.md', b: 'brainstorming/SKILL.md' };
    expect(extractClaudeMentions(entry)).toEqual(['brainstorming']);
  });

  it('returns empty for entries with no skill references', () => {
    expect(extractClaudeMentions({ type: 'user', content: 'hello' })).toEqual([]);
  });
});

describe('extractCodexMentions', () => {
  it('finds SKILL.md path from history entry', () => {
    const entry = { text: 'read /home/user/.agents/skills/brainstorming/SKILL.md' };
    expect(extractCodexMentions(entry)).toContain('brainstorming');
  });

  it('finds $skill-name tokens', () => {
    const entry = { text: 'using $writing-plans skill' };
    expect(extractCodexMentions(entry)).toContain('writing-plans');
  });

  it('returns empty for unrelated text', () => {
    expect(extractCodexMentions({ text: 'hello world' })).toEqual([]);
  });
});
