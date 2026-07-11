export function isUserTurnEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (e.type !== 'user') return false;
  const msg = e.message as Record<string, unknown> | undefined;
  if (msg?.role !== 'user') return false;
  const content = msg.content;
  if (typeof content === 'string') return true;
  if (!Array.isArray(content)) return false;
  return content.some((c) => {
    if (typeof c !== 'object' || c === null) return false;
    return (c as Record<string, unknown>).type === 'text';
  });
}
