import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { setColorEnabled } from '../utils/ansi';
import { renderUsageTable, runUsage, type UsageArgs } from './usage';

afterEach(() => setColorEnabled(false));

describe('runUsage', () => {
  let home: string;
  let project: string;
  let log: MockInstance<typeof console.log>;
  let error: MockInstance<typeof console.log>;

  const args = (over: Partial<UsageArgs> = {}): UsageArgs => ({
    period: 'all',
    format: 'text',
    'scan-all-files': false,
    global: false,
    ...over,
  });
  const printed = (spy: MockInstance<typeof console.log>) => spy.mock.calls.map((c) => c[0]);

  beforeEach(() => {
    home = realpathSync(mkdtempSync(join(tmpdir(), 'skl-usg-unit-')));
    project = join(home, 'project');
    mkdirSync(join(project, '.git'), { recursive: true });
    vi.stubEnv('HOME', home);
    vi.spyOn(process, 'cwd').mockReturnValue(project);
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${code}`);
    });
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports no usage when neither agent has a session dir', async () => {
    await runUsage(args());
    expect(printed(log)).toEqual(['Project scope · Usage 0 times by all', 'No skill usage by all']);
    expect(error).not.toHaveBeenCalled();
  });

  it('exits 1 when --root does not exist', async () => {
    const root = join(home, 'missing');
    await expect(runUsage(args({ root }))).rejects.toThrow('exit 1');
    expect(printed(error)).toEqual([`--root ${root} does not exist`]);
    expect(log).not.toHaveBeenCalled();
  });

  it('reads an existing --root as global scope', async () => {
    const root = join(home, 'sessions');
    mkdirSync(root);
    await runUsage(args({ root, agent: 'claude-code' }));
    expect(printed(log)).toEqual(['Global scope · Usage 0 times by all', 'No skill usage by all']);
  });
});

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
