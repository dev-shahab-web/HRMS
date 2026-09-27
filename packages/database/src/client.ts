/**
 * Database client factory.
 *
 * Two drivers, one schema:
 *   - **PGlite** (`@electric-sql/pglite`) — real Postgres compiled to WASM,
 *     running in-process. Used for unit tests and local development, so the
 *     test suite exercises actual Postgres semantics (CHECKs, partial indexes,
 *     RLS) rather than a mock.
 *   - **postgres-js** — a real TCP connection, used by Node scripts and by
 *     Workers through Hyperdrive.
 *
 * This module deliberately imports nothing from `node:*` so it stays usable in
 * a Worker isolate.
 */

import { sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from './schema';

/**
 * Driver-agnostic handle. Both `PgliteDatabase` and `PostgresJsDatabase` widen
 * to this, so repositories and services can be written once against `Database`.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A transaction handle — what a tenant-scoped unit of work receives. */
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface PgliteOptions {
  /** Omit for an in-memory instance (tests). Pass a path for a file-backed one. */
  dataDir?: string;
}

/**
 * Create an in-process Postgres via PGlite. Call `migrateDatabase` (from
 * `./migrate`) before using it.
 */
export async function createPgliteDatabase(options: PgliteOptions = {}) {
  // Imported lazily so that Worker bundles which only use postgres-js never
  // pull in the WASM binary.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');

  const client = options.dataDir ? new PGlite(options.dataDir) : new PGlite();
  await client.waitReady;

  return drizzle(client, { schema, casing: 'snake_case' });
}

/**
 * Connect over TCP. Used by Node scripts (`migrate`, `seed`) and, inside a
 * Worker, with the connection string Hyperdrive injects.
 */
export async function createPostgresDatabase(connectionString: string) {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { default: postgres } = await import('postgres');

  const client = postgres(connectionString, {
    // One connection per request is the Hyperdrive-friendly setting; pooling
    // happens at the edge, not in the isolate.
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  return drizzle(client, { schema, casing: 'snake_case' });
}

/**
 * Anything that can execute a statement: the root handle and a transaction
 * alike. Kept structural so `rawQuery` works inside `withTenantContext`, which
 * is where most of the interesting queries actually run.
 */
export interface RawExecutor {
  execute(query: SQL): Promise<unknown>;
}

/**
 * Run a raw statement and get plain rows back.
 *
 * PGlite and postgres-js return different shapes from `db.execute()` — PGlite
 * gives `{ rows }`, postgres-js gives a row array directly. Normalizing here
 * keeps every caller (migrations, RLS checks, the isolation test) driver-blind.
 */
export async function rawQuery<T extends Record<string, unknown>>(
  db: RawExecutor,
  query: SQL,
): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Run `fn` inside a transaction with the tenant set for Row-Level Security.
 *
 * This is the **only** sanctioned way to touch tenant-scoped tables in a
 * request path (CLAUDE.md §1). The tenant id originates server-side from the
 * authenticated session and is bound as a query parameter — never interpolated
 * into SQL text, and never taken from a client payload.
 *
 * `set_config(..., true)` is transaction-local, so the setting cannot leak to
 * the next borrower of a pooled connection. `NULL` deliberately clears it: with
 * RLS forced, that yields zero tenant rows rather than "all rows".
 */
export async function withTenantContext<T>(
  db: Database,
  tenantId: string | null,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
