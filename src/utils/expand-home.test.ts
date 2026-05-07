import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandHome } from './expand-home';

describe('expandHome', () => {
  it('expands ~ to homedir', () => {
    expect(expandHome('~')).toBe(homedir());
  });
  it('expands ~/foo to path inside homedir', () => {
    expect(expandHome('~/foo')).toBe(`${homedir()}/foo`);
  });
  it('resolves relative paths', () => {
    expect(expandHome('.')).toBe(resolve('.'));
  });
  it('returns absolute paths unchanged', () => {
    expect(expandHome('/tmp/test')).toBe('/tmp/test');
  });
});
