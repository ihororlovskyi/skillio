import { afterEach, describe, expect, it } from 'vitest';
import { setColorEnabled } from '../utils/ansi';
import { renderUsageTable } from './usage';

afterEach(() => setColorEnabled(false));

describe('renderUsageTable', () => {
  it('renders the spec table with sums', () => {
    expect(
      renderUsageTable(
        [
          { name: 'hibob-scrapppp', counts: { codex: 11 }, cost: 262 },
          { name: 'hibob-scraping', counts: { codex: 11, 'claude-code': 0 }, cost: 262 },
        ],
        ['claude-code', 'codex'],
      ),
    ).toEqual([
      'skill           .agents  .claude  cost      total',
      'hibob-scraping  11       0        ~262 tok  ~2,882 tok',
      'hibob-scrapppp  11       0        ~262 tok  ~2,882 tok',
      '2 skills        22       0        ~524 tok  ~5,764 tok',
    ]);
  });

  it('shows only the selected agent, sorts by runs then name, keeps non-numeric costs', () => {
    expect(
      renderUsageTable(
        [
          { name: 'a', counts: { codex: 1 }, cost: 'missing' },
          { name: 'c', counts: { codex: 3 }, cost: 1000 },
          { name: 'b', counts: { codex: 3 }, cost: 'hidden' },
        ],
        ['codex'],
      ),
    ).toEqual([
      'skill     .agents  cost        total',
      'b         3        -           -',
      'c         3        ~1,000 tok  ~3,000 tok',
      'a         1        ~? tok      ~? tok',
      '3 skills  7        ~1,000 tok  ~3,000 tok',
    ]);
  });

  it('paints a missing skill red and others cyan', () => {
    setColorEnabled(true);
    const lines = renderUsageTable(
      [
        { name: 'gone', counts: { codex: 1 }, cost: 'missing' },
        { name: 'tdd', counts: { codex: 2 }, cost: 1 },
      ],
      ['codex'],
    );
    expect(lines[1]?.startsWith('\x1b[36mtdd\x1b[0m')).toBe(true);
    expect(lines[2]?.startsWith('\x1b[31mgone\x1b[0m')).toBe(true);
  });
});
