import { describe, expect, it } from 'vitest';
import { bold, cyan, green, red, setColorEnabled, yellow } from './ansi';

describe('ansi helpers', () => {
  it('wraps with ANSI codes when enabled', () => {
    setColorEnabled(true);
    expect(green('hi')).toBe('\x1b[32mhi\x1b[0m');
    expect(yellow('hi')).toBe('\x1b[33mhi\x1b[0m');
    expect(red('hi')).toBe('\x1b[31mhi\x1b[0m');
    expect(cyan('hi')).toBe('\x1b[36mhi\x1b[0m');
    expect(bold('hi')).toBe('\x1b[1mhi\x1b[22m');
  });

  it('returns raw text when disabled', () => {
    setColorEnabled(false);
    expect(green('hi')).toBe('hi');
    expect(yellow('hi')).toBe('hi');
    expect(red('hi')).toBe('hi');
    expect(cyan('hi')).toBe('hi');
    expect(bold('hi')).toBe('hi');
  });
});
