/** Indian fiscal year (April-March) for a date in IST, e.g. "2026-27". */
export function fiscalYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

/** UTC [start, end) of an Indian fiscal year string. */
export function fiscalYearRange(fy: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m || (Number(m[1]) + 1) % 100 !== Number(m[2])) throw new Error('Invalid fiscal year');
  const y = Number(m[1]);
  const at = (year: number) => new Date(Date.UTC(year, 3, 1) - 5.5 * 3600_000);
  return { start: at(y), end: at(y + 1) };
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Section 80G does not allow deductions on cash gifts above this amount (paise). */
export const CASH_80G_LIMIT_MINOR = 200_000n;
