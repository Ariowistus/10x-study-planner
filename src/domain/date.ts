import type { IsoDate, Weekday } from "./types";

/**
 * Date helpers for the planner.
 *
 * Everything is computed in UTC on `YYYY-MM-DD` strings. The planner deals in
 * calendar days, never in instants, so time zones must not be allowed to shift
 * a session onto the wrong day.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseIsoDate(value: IsoDate): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${value}"`);
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`"${value}" is not a valid calendar date`);
  }
  return new Date(timestamp);
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

/** Weekday index with Monday as 0, which is how availability is stored. */
export function weekdayIndex(value: IsoDate): Weekday {
  const jsDay = parseIsoDate(value).getUTCDay(); // 0 is Sunday in JavaScript
  return ((jsDay + 6) % 7) as Weekday;
}

/** The Monday of the week containing `value`. */
export function startOfWeek(value: IsoDate): IsoDate {
  return addDays(value, -weekdayIndex(value));
}
