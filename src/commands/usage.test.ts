import { describe, expect, it } from 'vitest';
import { formatUsageRow } from './usage';

describe('formatUsageRow', () => {
  it('renders a single-digit count padded to width', () => {
    expect(
      formatUsageRow({
        count: 8,
        name: 'brainstorming',
        countWidth: 2,
      }),
    ).toBe(' 8 brainstorming');
  });

  it('renders a multi-digit count without padding overflow', () => {
    expect(
      formatUsageRow({
        count: 91,
        name: 'subagent-driven-development',
        countWidth: 2,
      }),
    ).toBe('91 subagent-driven-development');
  });

  it('renders a zero count with width-aligned padding', () => {
    expect(
      formatUsageRow({
        count: 0,
        name: 'frontend-design',
        countWidth: 2,
      }),
    ).toBe(' 0 frontend-design');
  });
});
