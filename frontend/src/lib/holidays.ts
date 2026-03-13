/**
 * Mexican public holidays — used to exclude from business day calculations.
 */

/** Get the nth occurrence of a weekday in a given month. */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  // weekday: 0=Sunday, 1=Monday, ... 6=Saturday
  const first = new Date(year, month - 1, 1);
  let firstOccurrence = first.getDay();
  let dayOfMonth = 1 + ((weekday - firstOccurrence + 7) % 7);
  dayOfMonth += (n - 1) * 7;
  const m = String(month).padStart(2, "0");
  const d = String(dayOfMonth).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Returns YYYY-MM-DD strings for official Mexican public holidays in the given year. */
export function getMexicanHolidays(year: number): string[] {
  return [
    `${year}-01-01`, // Año Nuevo
    getNthWeekdayOfMonth(year, 2, 1, 1), // Día de la Constitución (1er lunes de febrero)
    getNthWeekdayOfMonth(year, 3, 1, 3), // Natalicio de Benito Juárez (3er lunes de marzo)
    `${year}-05-01`, // Día del Trabajo
    `${year}-09-16`, // Día de la Independencia
    getNthWeekdayOfMonth(year, 11, 1, 3), // Revolución Mexicana (3er lunes de noviembre)
    `${year}-12-25`, // Navidad
  ];
}

const holidayCache = new Map<number, Set<string>>();

/** Check if a YYYY-MM-DD date string is a Mexican public holiday. */
export function isHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (!holidayCache.has(year)) {
    holidayCache.set(year, new Set(getMexicanHolidays(year)));
  }
  return holidayCache.get(year)!.has(dateStr);
}
