import { describe, expect, it } from 'vitest';
import { extractClaudeMentions, extractCodexMentions } from './mentions';

describe('extractClaudeMentions', () => {
  it('finds SKILL.md path in string values', () => {
    const entry = { content: 'loading skill-foo/SKILL.md for context' };
    expect(extractClaudeMentions(entry)).toContain('skill-foo');
  });

  it('finds superpowers: tokens', () => {
    const entry = { content: 'superpowers:skill-bar is active' };
    expect(extractClaudeMentions(entry)).toContain('superpowers:skill-bar');
  });

  it('deduplicates within an entry', () => {
    const entry = { a: 'skill-foo/SKILL.md', b: 'skill-foo/SKILL.md' };
    expect(extractClaudeMentions(entry)).toEqual(['skill-foo']);
  });

  it('returns empty for entries with no skill references', () => {
    expect(extractClaudeMentions({ type: 'user', content: 'hello' })).toEqual([]);
  });
});

describe('extractCodexMentions', () => {
  it('finds SKILL.md path from history entry', () => {
    const entry = { text: 'read /home/user/.agents/skills/skill-foo/SKILL.md' };
    expect(extractCodexMentions(entry)).toContain('skill-foo');
  });

  it('finds $skill-name tokens', () => {
    const entry = { text: 'using $skill-bar skill' };
    expect(extractCodexMentions(entry)).toContain('skill-bar');
  });

  it('returns empty for unrelated text', () => {
    expect(extractCodexMentions({ text: 'hello world' })).toEqual([]);
  });
});
