import { describe, expect, it } from 'vitest';
import { formatUsageRow } from './usage';

describe('formatUsageRow', () => {
  it('renders a single-digit count padded to width', () => {
    expect(
      formatUsageRow({
        count: 8,
        name: 'skill-foo',
        countWidth: 2,
      }),
    ).toBe(' 8 skill-foo');
  });

  it('renders a multi-digit count without padding overflow', () => {
    expect(
      formatUsageRow({
        count: 91,
        name: 'skill-corge',
        countWidth: 2,
      }),
    ).toBe('91 skill-corge');
  });

  it('renders a zero count with width-aligned padding', () => {
    expect(
      formatUsageRow({
        count: 0,
        name: 'skill-baz',
        countWidth: 2,
      }),
    ).toBe(' 0 skill-baz');
  });
});
