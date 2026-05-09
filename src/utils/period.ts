const UNITS: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parsePeriod(period: string): number {
  if (period === 'all') return Number.POSITIVE_INFINITY;
  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) throw new Error(`Invalid period: "${period}". Use values like 7d, 2w, 1m, 1y, all.`);
  const unit = UNITS[match[2] ?? ''] ?? 1;
  return Number(match[1]) * unit;
}

export function periodToDate(period: string): Date {
  if (period === 'all') return new Date(0);
  return new Date(Date.now() - parsePeriod(period) * MS_PER_DAY);
}
