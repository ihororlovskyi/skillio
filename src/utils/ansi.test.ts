import { describe, expect, it } from 'vitest';
import { green, red, setColorEnabled, yellow } from './ansi';

describe('ansi helpers', () => {
  it('wraps with ANSI codes when enabled', () => {
    setColorEnabled(true);
    expect(green('hi')).toBe('\x1b[32mhi\x1b[0m');
    expect(yellow('hi')).toBe('\x1b[33mhi\x1b[0m');
    expect(red('hi')).toBe('\x1b[31mhi\x1b[0m');
  });

  it('returns raw text when disabled', () => {
    setColorEnabled(false);
    expect(green('hi')).toBe('hi');
    expect(yellow('hi')).toBe('hi');
    expect(red('hi')).toBe('hi');
  });
});
