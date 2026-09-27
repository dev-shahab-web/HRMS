/**
 * Primitive, framework-free type aliases shared across the domain.
 * These are intentionally plain (not branded) to interoperate cleanly with
 * Drizzle rows and Zod-parsed values; semantic naming documents intent.
 */

/** RFC 9562 UUID (we use v7). */
export type Uuid = string;

/** ISO-8601 instant in UTC, e.g. `2026-09-24T10:00:00.000Z`. */
export type IsoDateTime = string;

/** Calendar date with no time/zone, `YYYY-MM-DD`. A business concept, not an instant. */
export type IsoDate = string;

/** IANA time zone identifier, e.g. `Asia/Kolkata`. */
export type TimeZone = string;

/** ISO-4217 currency code, e.g. `INR`, `USD`. Always upper-case. */
export type CurrencyCode = string;

/** Exhaustiveness helper for `switch`/union handling. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${String(value)}`);
}
