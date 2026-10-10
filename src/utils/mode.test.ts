import { describe, expect, it } from 'vitest';
import { extractMode } from './mode';

describe('extractMode', () => {
  it.each([
    [['a', '-m', 's', '-y'], 'silent', ['a', '-y']],
    [['a', '--mode', 'silent'], 'silent', ['a']],
    [['--mode=silent', 'a'], 'silent', ['a']],
    [['-m', 'silent', 'a', '-m', 's'], 'silent', ['a']],
    [['a', '-m', 'q'], 'quiet', ['a']],
    [['a', '--mode=quiet'], 'quiet', ['a']],
    [['-m', 'c', 'a'], 'clear', ['a']],
    [['a', '--mode', 'clear'], 'clear', ['a']],
  ])('%j -> %s', (argv, mode, rest) => {
    expect(extractMode(argv)).toEqual({ kind: 'ok', mode, rest });
  });

  it('defaults to clear and keeps the argv without -m', () => {
    expect(extractMode(['a', '-y'])).toEqual({ kind: 'ok', mode: 'clear', rest: ['a', '-y'] });
  });

  it.each([
    [['-m'], '-m needs a value: clear (c), silent (s) or quiet (q)'],
    [['-m', '-y'], '-m needs a value: clear (c), silent (s) or quiet (q)'],
    [['--mode'], '--mode needs a value: clear (c), silent (s) or quiet (q)'],
    [['--mode', 'loud'], 'unknown mode "loud", use clear (c), silent (s) or quiet (q)'],
    [['--mode='], 'unknown mode "", use clear (c), silent (s) or quiet (q)'],
    [['-m', 's', '-m', 'q'], 'conflicting modes: silent and quiet'],
    [['--mode=clear', '-m', 's'], 'conflicting modes: clear and silent'],
  ])('rejects %j', (argv, message) => {
    expect(extractMode(argv)).toEqual({ kind: 'error', message });
  });
});
