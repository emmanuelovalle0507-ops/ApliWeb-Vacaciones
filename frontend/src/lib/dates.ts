/**
 * Calculate business days between two dates (inclusive).
 * Excludes Saturdays and Sundays. Does NOT consider holidays.
 */
export function businessDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/** Check if a date string falls on a weekend */
export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

/** Get today as YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
