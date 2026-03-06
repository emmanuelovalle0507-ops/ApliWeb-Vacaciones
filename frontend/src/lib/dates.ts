import { isHoliday } from "./holidays";

/**
 * Calculate business days between two dates (inclusive).
 * Excludes Saturdays, Sundays, and Mexican public holidays.
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
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (day !== 0 && day !== 6 && !isHoliday(dateStr)) count++;
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
