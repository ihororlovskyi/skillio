import { walk } from '../utils/walk';

export function extractClaudeMentions(entry: unknown): string[] {
  const seen = new Set<string>();
  walk(entry, (node) => {
    if (typeof node !== 'string') return;
    for (const m of node.matchAll(
      /(?:^|[":\s])((?:[a-z0-9-]+:)?[a-z0-9][a-z0-9-]{1,})\/SKILL\.md\b/g,
    )) {
      if (m[1] !== undefined) seen.add(m[1]);
    }
    for (const m of node.matchAll(/\bsuperpowers:([a-z0-9-]+)\b/g)) {
      if (m[1] !== undefined) seen.add(`superpowers:${m[1]}`);
    }
  });
  return [...seen];
}

export function extractCodexMentions(entry: unknown): string[] {
  const seen = new Set<string>();
  walk(entry, (node) => {
    if (typeof node !== 'string') return;
    for (const m of node.matchAll(/\/([^/)\]\s]+)\/SKILL\.md\b/g)) {
      if (m[1] !== undefined) seen.add(m[1]);
    }
    for (const m of node.matchAll(/\$([a-z0-9][a-z0-9-]{1,})\b/g)) {
      if (m[1] !== undefined) seen.add(m[1]);
    }
  });
  return [...seen];
}
