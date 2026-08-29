/**
 * Calendar-day helpers, deliberately in a module with no 'use client'.
 *
 * They are needed on both sides: a server component computes the day it is
 * rendering on, and the browser recomputes it in the viewer's own zone. A
 * function exported from a client module cannot be called on the server — it
 * arrives there as a client reference and throws — so it cannot live next to
 * the component that uses it.
 *
 * Everything here is date-only. A timestamp would carry a zone with it, and the
 * whole point is to compare the day two different machines think it is.
 */

/** A calendar day with no time and no zone, as YYYY-MM-DD in local terms. */
export function toLocalDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parsed back as local midnight — `new Date('2026-08-30')` would be UTC. */
export function fromLocalDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/** Today, in whatever zone the code asking happens to be running in. */
export function localToday(): string {
  return toLocalDay(new Date());
}
