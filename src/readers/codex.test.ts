import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCodexUsage } from './codex';

let tmp = '';
let sessions = '';
let history = '';
const project = '/work/proj';
const ts = Math.floor(Date.now() / 1000);

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'skl-codex-'));
  sessions = join(tmp, 'sessions');
  mkdirSync(sessions);
  history = join(tmp, 'history.jsonl');
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function session(name: string, payload: { id: string; session_id?: string; cwd: string }): string {
  const file = join(sessions, `${name}.jsonl`);
  writeFileSync(file, `${JSON.stringify({ type: 'session_meta', payload })}\n`);
  return file;
}

function writeHistory(entries: Array<{ session_id: string; text: string }>): void {
  writeFileSync(history, entries.map((e) => JSON.stringify({ ...e, ts })).join('\n'));
}

const mentions = (projectRoot?: string) =>
  readCodexUsage({ since: new Date(0), mode: 'mentions', root: sessions, history, projectRoot })
    .counts;

describe('readCodexUsage mentions', () => {
  it('counts only history entries of sessions in the project', () => {
    session('in', { id: 's-in', cwd: project });
    session('out', { id: 's-out', cwd: '/work/other' });
    writeHistory([
      { session_id: 's-in', text: 'use $skill-a' },
      { session_id: 's-out', text: 'use $skill-b' },
    ]);
    expect(Object.fromEntries(mentions(project))).toEqual({ 'skill-a': 1 });
  });

  it('matches history session_id against both payload.id and payload.session_id', () => {
    session('in', { id: 'x', session_id: 'y', cwd: `${project}/sub` });
    session('out', { id: 's-out', cwd: '/work/other' });
    writeHistory([
      { session_id: 'x', text: 'use $skill-a' },
      { session_id: 'y', text: 'use $skill-c' },
      { session_id: 's-out', text: 'use $skill-b' },
    ]);
    expect(Object.fromEntries(mentions(project))).toEqual({ 'skill-a': 1, 'skill-c': 1 });
  });

  it('counts all history entries without projectRoot', () => {
    session('in', { id: 's-in', cwd: project });
    session('out', { id: 's-out', cwd: '/work/other' });
    writeHistory([
      { session_id: 's-in', text: 'use $skill-a' },
      { session_id: 's-out', text: 'use $skill-b' },
    ]);
    expect(Object.fromEntries(mentions())).toEqual({ 'skill-a': 1, 'skill-b': 1 });
  });

  it('collects project sessions regardless of since', () => {
    const old = session('in', { id: 's-in', cwd: project });
    utimesSync(old, new Date(2000, 0, 1), new Date(2000, 0, 1));
    session('out', { id: 's-out', cwd: '/work/other' });
    writeHistory([
      { session_id: 's-in', text: 'use $skill-a' },
      { session_id: 's-out', text: 'use $skill-b' },
    ]);
    const { counts } = readCodexUsage({
      since: new Date(Date.now() - 60_000),
      mode: 'mentions',
      root: sessions,
      history,
      projectRoot: project,
    });
    expect(Object.fromEntries(counts)).toEqual({ 'skill-a': 1 });
  });
});
