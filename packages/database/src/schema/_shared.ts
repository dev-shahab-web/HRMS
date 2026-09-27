import { newId } from '@hrms/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Shared column builders and helpers. These are **functions** (not shared
 * builder instances) so every table gets its own fresh column definition.
 */

/** UUIDv7 primary key, generated in-app via `@hrms/domain` `newId()`. */
export function primaryId() {
  return uuid('id')
    .primaryKey()
    .$defaultFn(() => newId());
}

/**
 * A business **date** (no time, no timezone) — joining dates, leave periods,
 * effective-from dates. Read and written as a `YYYY-MM-DD` string so it never
 * drifts across the server/browser/DB timezone boundary (CLAUDE.md §6).
 * Deliberately NOT `timestamptz`: a joining date is a calendar fact, not an
 * instant.
 */
export function dateOnly(name: string) {
  return date(name, { mode: 'string' });
}

/** Optimistic-concurrency counter for mutable, concurrency-sensitive rows. */
export function versionColumn() {
  return integer('version').notNull().default(0);
}

/**
 * A nullable `timestamptz` column. All instants are stored in UTC; local-time
 * interpretation is the caller's job, using an explicit IANA zone.
 */
export function tzTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}

/** `created_at` / `updated_at` (timestamptz). `updated_at` auto-bumps on ORM update. */
export function timestamps() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

/**
 * A `CHECK (column IN ('a','b',...))` constraint for a closed text set.
 * Values are inlined as quoted SQL literals via `sql.raw` (single-quotes
 * escaped) so drizzle-kit emits static DDL rather than bind parameters.
 */
export function inList(name: string, column: AnyPgColumn, values: readonly string[]) {
  const quoted = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  return check(name, sql`${column} IN (${sql.raw(quoted)})`);
}
