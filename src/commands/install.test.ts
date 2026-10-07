import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInstall, type SpawnOutcome } from './install';

afterEach(() => vi.restoreAllMocks());

describe('runInstall', () => {
  it('passes args to npx skills add unchanged and in order', () => {
    const spawn = vi.fn((_command: string, _args: string[]): SpawnOutcome => ({ status: 0 }));
    const status = runInstall(
      ['sentimony/skills', '-s', 'cross-review', 'tdd', '-a', 'codex', 'claude-code', '-y'],
      spawn,
    );
    expect(status).toBe(0);
    expect(spawn).toHaveBeenCalledWith('npx', [
      '-y',
      'skills',
      'add',
      'sentimony/skills',
      '-s',
      'cross-review',
      'tdd',
      '-a',
      'codex',
      'claude-code',
      '-y',
    ]);
  });

  it('returns the npx exit code', () => {
    const spawn = vi.fn((_command: string, _args: string[]): SpawnOutcome => ({ status: 3 }));
    expect(runInstall(['sentimony/skills'], spawn)).toBe(3);
  });

  it('returns 1 and reports the error when npx cannot start', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spawn = vi.fn(
      (_command: string, _args: string[]): SpawnOutcome => ({
        status: null,
        error: new Error('spawn npx ENOENT'),
      }),
    );
    expect(runInstall(['sentimony/skills'], spawn)).toBe(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('ENOENT'));
  });

  it('prints its own help for -h without spawning npx', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const spawn = vi.fn((_command: string, _args: string[]): SpawnOutcome => ({ status: 0 }));
    expect(runInstall(['-h'], spawn)).toBe(0);
    expect(runInstall(['sentimony/skills', '--help'], spawn)).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('npx -y skills add'));
  });
});
