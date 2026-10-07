import { describe, expect, it } from 'vitest';
import { extractMode } from './mode';

describe('extractMode', () => {
  it.each([
    [
      ['a', '-m', 's', '-y'],
      ['a', '-y'],
    ],
    [['a', '--mode', 'silent'], ['a']],
    [['--mode=silent', 'a'], ['a']],
    [['-m', 'silent', 'a', '-m', 's'], ['a']],
  ])('accepts %j', (argv, rest) => {
    expect(extractMode(argv)).toEqual({ kind: 'ok', silent: true, rest });
  });

  it('returns silent: false and the argv unchanged without -m', () => {
    expect(extractMode(['a', '-y'])).toEqual({ kind: 'ok', silent: false, rest: ['a', '-y'] });
  });

  it.each([
    [['-m'], '-m needs a value: silent (s)'],
    [['-m', '-y'], '-m needs a value: silent (s)'],
    [['--mode', 'loud'], 'unknown mode "loud", use silent (s)'],
    [['--mode='], 'unknown mode "", use silent (s)'],
  ])('rejects %j', (argv, message) => {
    expect(extractMode(argv)).toEqual({ kind: 'error', message });
  });
});
