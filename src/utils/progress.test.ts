import { afterEach, describe, expect, it, vi } from 'vitest';
import { setColorEnabled } from './ansi';
import { createProgress, renderBar } from './progress';

afterEach(() => {
  vi.restoreAllMocks();
  setColorEnabled(false);
});

describe('renderBar', () => {
  it('fills whole cells and floors the percent', () => {
    expect(renderBar(0)).toBe('░░░░░░░░░░ 0%');
    expect(renderBar(0.28)).toBe('██░░░░░░░░ 28%');
    expect(renderBar(1)).toBe('██████████ 100%');
  });

  it('moves a two-cell block without a percent when the total is unknown', () => {
    expect(renderBar(null, 0)).toBe('██░░░░░░░░');
    expect(renderBar(null, 8)).toBe('░░░░░░░░██');
    expect(renderBar(null, 9)).toBe('██░░░░░░░░');
  });

  it('paints the cells green and leaves the percent plain', () => {
    setColorEnabled(true);
    expect(renderBar(0.25)).toBe('\x1b[32m██░░░░░░░░\x1b[0m 25%');
    expect(renderBar(null, 1)).toBe('\x1b[32m░██░░░░░░░\x1b[0m');
  });
});

describe('createProgress', () => {
  const tty = () => {
    const writes: string[] = [];
    return { writes, out: { isTTY: true, write: (s: string) => void writes.push(s) } };
  };

  it('redraws one line in a TTY and ends with the summary', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { writes, out } = tty();
    const p = createProgress('Symlinking from ../clone', out);
    p.update(0.5);
    p.done('Symlinked 2 skills');
    expect(writes).toEqual(['\r\x1b[2KSymlinking from ../clone █████░░░░░ 50%', '\r\x1b[2K']);
    expect(log).toHaveBeenCalledWith(
      'Symlinking from ../clone ██████████ 100% · Symlinked 2 skills',
    );
  });

  it('prints only the final line outside a TTY', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writes: string[] = [];
    const p = createProgress('Installing', { isTTY: false, write: (s) => void writes.push(s) });
    p.update(0.5);
    p.done('Installed 0 skills');
    expect(writes).toEqual([]);
    expect(log.mock.calls).toEqual([['Installing ██████████ 100% · Installed 0 skills']]);
  });

  it('shortens the label so a frame fits one terminal row', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const writes: string[] = [];
    const out = { isTTY: true, columns: 40, write: (s: string) => void writes.push(s) };
    const label = 'Symlinking from /Users/someone/work/github/sentimony/skills';
    const p = createProgress(label, out);
    p.update(0.5);
    p.done('Symlinked 2 skills');
    // 40 columns - 1 spare - 16 for " ██████████ 100%" leaves 23 for the label
    expect(writes[0]).toBe('\r\x1b[2KSymlinking from /Users… █████░░░░░ 50%');
    expect(writes[0]?.replace('\r\x1b[2K', '').length).toBeLessThan(40);
  });

  it('keeps the whole label in the final line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = { isTTY: true, columns: 20, write: () => {} };
    const p = createProgress('Installing from https://github.com/a/b', out);
    p.update(0);
    p.done('Installed 1 skill');
    expect(log).toHaveBeenCalledWith(
      'Installing from https://github.com/a/b ██████████ 100% · Installed 1 skill',
    );
  });

  it('keeps the partial bar on failure in a TTY and prints the label outside one', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { writes, out } = tty();
    const p = createProgress('Installing', out);
    p.update(null);
    p.fail();
    expect(writes.at(-1)).toBe('\n');
    createProgress('Installing', { isTTY: false, write: () => {} }).fail();
    expect(log.mock.calls).toEqual([['Installing']]);
  });
});
