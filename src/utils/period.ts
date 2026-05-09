const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const UNITS_MS: Record<string, number> = {
  sec: SECOND_MS,
  min: MINUTE_MS,
  h: HOUR_MS,
  d: DAY_MS,
  w: 7 * DAY_MS,
  m: 30 * DAY_MS,
  y: 365 * DAY_MS,
};

export function parsePeriod(period: string): number {
  if (period === 'all') return Number.POSITIVE_INFINITY;
  const match = period.match(/^(\d+)(sec|min|[hdwmy])$/);
  if (!match) {
    throw new Error(
      `Invalid period: "${period}". Use values like 30sec, 5min, 12h, 7d, 2w, 1m, 1y, all.`,
    );
  }
  const unit = UNITS_MS[match[2] ?? ''] ?? 0;
  return Number(match[1]) * unit;
}

export function periodToDate(period: string): Date {
  if (period === 'all') return new Date(0);
  return new Date(Date.now() - parsePeriod(period));
}
