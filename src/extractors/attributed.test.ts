import { describe, expect, it } from 'vitest';
import { extractAttributed } from './attributed';

describe('extractAttributed', () => {
  it('returns skill from attributionSkill field', () => {
    expect(extractAttributed({ attributionSkill: 'brainstorming' })).toEqual(['brainstorming']);
  });
  it('returns empty when field is missing', () => {
    expect(extractAttributed({ type: 'user', content: [] })).toEqual([]);
  });
  it('returns empty when field is not a string', () => {
    expect(extractAttributed({ attributionSkill: 42 })).toEqual([]);
  });
  it('returns empty for null', () => expect(extractAttributed(null)).toEqual([]));
  it('returns empty for primitive', () => expect(extractAttributed('text')).toEqual([]));
  it('returns empty for array', () => expect(extractAttributed([])).toEqual([]));
});
