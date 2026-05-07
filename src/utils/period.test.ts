import { describe, expect, it } from 'vitest';
import { parsePeriod, periodToDate } from './period';

describe('parsePeriod', () => {
  it('parses days', () => expect(parsePeriod('7d')).toBe(7));
  it('parses weeks', () => expect(parsePeriod('2w')).toBe(14));
  it('parses months', () => expect(parsePeriod('1m')).toBe(30));
  it('parses years', () => expect(parsePeriod('1y')).toBe(365));
  it('throws on invalid format', () => expect(() => parsePeriod('foo')).toThrow('Invalid period'));
  it('throws on unknown unit', () => expect(() => parsePeriod('5x')).toThrow('Invalid period'));
});

describe('periodToDate', () => {
  it('returns a Date in the past', () => {
    const d = periodToDate('7d');
    expect(d.getTime()).toBeLessThan(Date.now());
    expect(d.getTime()).toBeGreaterThan(Date.now() - 8 * 24 * 60 * 60 * 1000);
  });
});
