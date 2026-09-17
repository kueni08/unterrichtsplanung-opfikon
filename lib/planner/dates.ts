/** Datumshilfen – alles in lokaler Zeit, Wochen beginnen am Montag. */

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (result.getDay() + 6) % 7; // Montag = 0
  result.setDate(result.getDate() - weekday);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

export function weekStartFor(base: Date, offset: number): string {
  return isoDate(addDays(mondayOf(base), offset * 7));
}

/** Kalenderwoche nach ISO 8601 (gilt in der Schweiz). */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Donnerstag derselben Woche
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
