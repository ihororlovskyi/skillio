export function extractAttributed(entry: unknown): string[] {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
  const skill = (entry as Record<string, unknown>).attributionSkill;
  return typeof skill === 'string' ? [skill] : [];
}
