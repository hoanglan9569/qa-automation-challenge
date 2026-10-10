/**
 * Dates and time, on date-fns. The rest of the code goes through this module,
 * never date-fns or `Date` directly (ESLint enforces it), so every date the
 * suite writes or reads uses one of the patterns below.
 *
 * No Node APIs: k6/ bundles this module too.
 */

import {
  differenceInMilliseconds,
  type Duration,
  format,
  fromUnixTime,
  getUnixTime,
  milliseconds,
  millisecondsToSeconds,
  parseISO,
} from 'date-fns';

/** date-fns `format` patterns (https://date-fns.org/docs/format). */
export const DateFormat = {
  /** The purchase receipt, as the site prints it: 1/9/2026, no leading zeros. */
  RECEIPT: 'd/M/yyyy',
  /** Card expiry month in the order form: 3. */
  CARD_MONTH: 'M',
  /** Card expiry year in the order form: 2029. */
  CARD_YEAR: 'yyyy',
  /** Log lines: local time and its UTC offset, 2026-10-11 14:05:09 +07:00. */
  LOG: 'yyyy-MM-dd HH:mm:ss xxx',
  /** Sortable stamp that makes a name unique, e.g. a throwaway user: 20261011-140509. */
  STAMP: 'yyyyMMdd-HHmmss',
} as const;
export type DateFormat = (typeof DateFormat)[keyof typeof DateFormat];

export function now(): Date {
  return new Date();
}

export function formatDate(date: Date, pattern: DateFormat): string {
  return format(date, pattern);
}

/** Whole seconds since the Unix epoch, the unit cookies expire in. Now by default. */
export function epochSeconds(date: Date = now()): number {
  return getUnixTime(date);
}

export function fromEpochSeconds(seconds: number): Date {
  return fromUnixTime(seconds);
}

/** A date in ISO 8601, as reporters write it: 2026-10-11T02:17:05.123Z. */
export function fromIso(iso: string): Date {
  return parseISO(iso);
}

/** A duration in ms: `toMs({ seconds: 10 })`. */
export function toMs(duration: Duration): number {
  return milliseconds(duration);
}

/** A duration in whole seconds: `toSeconds({ hours: 8 })`. */
export function toSeconds(duration: Duration): number {
  return millisecondsToSeconds(milliseconds(duration));
}

/** Starts a timer; call the result for the ms elapsed since. */
export function stopwatch(): () => number {
  const started = now();
  return () => differenceInMilliseconds(now(), started);
}

/** A duration in a message: 1234.6 → "1235 ms". */
export function formatMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

/** How long a run took, for people: 312400 → "5m 12s", 41000 → "41s". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
