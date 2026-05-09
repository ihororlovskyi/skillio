import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface AuditScope {
  global: boolean;
  projectRoot?: string;
}

export interface ScopeOptions {
  global?: boolean;
  rootOverride?: boolean;
  cwd: string;
  home?: string;
}

export function detectScope(opts: ScopeOptions): AuditScope {
  const home = opts.home ?? homedir();
  if (opts.global || opts.rootOverride) return { global: true };
  if (norm(opts.cwd) === norm(home)) return { global: true };
  return { global: false, projectRoot: findGitRoot(opts.cwd) ?? opts.cwd };
}

export function isPathInProject(path: string, projectRoot: string): boolean {
  const p = norm(path);
  const r = norm(projectRoot);
  return p === r || p.startsWith(`${r}/`);
}

export function encodeClaudeProjectDir(absPath: string): string {
  return absPath.replaceAll('/', '-');
}

function findGitRoot(start: string): string | undefined {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function norm(p: string): string {
  return p.toLowerCase().replace(/\/+$/, '');
}
