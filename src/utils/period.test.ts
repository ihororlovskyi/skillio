import { describe, expect, it } from 'vitest';
import { parsePeriod, periodToDate } from './period';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('parsePeriod', () => {
  it('parses seconds', () => expect(parsePeriod('30sec')).toBe(30 * SEC));
  it('parses minutes', () => expect(parsePeriod('5min')).toBe(5 * MIN));
  it('parses hours', () => expect(parsePeriod('12h')).toBe(12 * HOUR));
  it('parses days', () => expect(parsePeriod('7d')).toBe(7 * DAY));
  it('parses weeks', () => expect(parsePeriod('2w')).toBe(14 * DAY));
  it('parses months', () => expect(parsePeriod('1m')).toBe(30 * DAY));
  it('parses years', () => expect(parsePeriod('1y')).toBe(365 * DAY));
  it('parses "all" as infinity', () => expect(parsePeriod('all')).toBe(Number.POSITIVE_INFINITY));
  it('throws on invalid format', () => expect(() => parsePeriod('foo')).toThrow('Invalid period'));
  it('throws on unknown unit', () => expect(() => parsePeriod('5x')).toThrow('Invalid period'));
  it('throws on bare s', () => expect(() => parsePeriod('5s')).toThrow('Invalid period'));
});

describe('periodToDate', () => {
  it('returns a Date in the past', () => {
    const d = periodToDate('7d');
    expect(d.getTime()).toBeLessThan(Date.now());
    expect(d.getTime()).toBeGreaterThan(Date.now() - 8 * DAY);
  });
  it('"all" returns epoch', () => expect(periodToDate('all').getTime()).toBe(0));
});
