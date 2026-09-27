/**
 * Time handling. Storage is always UTC (`IsoDateTime`); business "calendar day"
 * questions are answered against an explicit IANA time zone. `IsoDate` is a
 * zoneless calendar date. See CLAUDE.md §6. No wall-clock math is done with
 * the local server zone — it is never trusted.
 */

import { ValidationFailed } from './errors';
import type { IsoDate, IsoDateTime, TimeZone } from './types';

/** Current instant as an ISO-8601 UTC string. */
export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

/** Is `timeZone` a resolvable IANA identifier in this runtime? */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.length === 0) {
    return false;
  }
  try {
    // Throws RangeError for unknown zones.
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Assert and narrow a string to a valid `TimeZone`, else throw. */
export function assertValidTimeZone(timeZone: string): TimeZone {
  if (!isValidTimeZone(timeZone)) {
    throw new ValidationFailed(`Invalid IANA time zone: "${timeZone}".`);
  }
  return timeZone;
}

/** Is `value` a syntactically valid `YYYY-MM-DD` calendar date? */
export function isValidIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(timestamp);
}

/**
 * The calendar date (`YYYY-MM-DD`) on which `instant` falls in `timeZone`.
 * Example: an instant at 23:30 UTC is "tomorrow" in `Asia/Kolkata`.
 */
export function toDateOnlyInTimeZone(instant: IsoDateTime | Date, timeZone: TimeZone): IsoDate {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) {
    throw new ValidationFailed(`Invalid instant: "${String(instant)}".`);
  }
  assertValidTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`;
}
