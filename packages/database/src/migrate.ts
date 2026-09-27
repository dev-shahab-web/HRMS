/**
 * Migration runner.
 *
 * Deliberately **not** using `drizzle-kit migrate`. drizzle-kit is a dev-time
 * code generator here (`db:generate`); applying SQL is done from this module so
 * that:
 *   - the same code path runs in tests (PGlite) and in a real environment;
 *   - the journal/migrations table is under our control;
 *   - the RLS policies in `src/rls/` are applied immediately after the schema,
 *     in the same run, so a database can never exist with tables but no
 *     policies.
 *
 * Migrations are forward-only (CLAUDE.md §8). The `__drizzle_migrations` table
 * records which files have run, by content hash, so re-running is a no-op.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { sql } from 'drizzle-orm';

import type { Database } from './client';
import { rawQuery } from './client';
import { RLS_POLICIES_SQL } from './rls/policies';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export interface MigrationResult {
  /** Filenames applied in this run, in order. Empty when already current. */
  applied: string[];
  /** Filenames that were already recorded as applied. */
  skipped: string[];
}

async function ensureJournal(db: Database): Promise<void> {
  await db.execute(sql`
    create table if not exists "__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint not null
    )
  `);
}

async function appliedHashes(db: Database): Promise<Set<string>> {
  const rows = await rawQuery<{ hash: string }>(db, sql`select hash from "__drizzle_migrations"`);
  return new Set(rows.map((row) => row.hash));
}

/**
 * Apply every pending migration, then the RLS policies. Idempotent.
 *
 * `statementsBreakpoint` splits the file the same way drizzle-kit does — it
 * writes `--> statement-breakpoint` between statements because some DDL cannot
 * share a batch.
 */
export async function migrateDatabase(db: Database): Promise<MigrationResult> {
  await ensureJournal(db);
  const alreadyApplied = await appliedHashes(db);

  const entries = await readdir(MIGRATIONS_DIR).catch(() => [] as string[]);
  const files = entries.filter((name) => name.endsWith('.sql')).sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const contents = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const hash = createHash('sha256').update(contents).digest('hex');

    if (alreadyApplied.has(hash)) {
      skipped.push(file);
      continue;
    }

    const statements = contents
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    // One transaction per migration file: a failure leaves no partial schema.
    await db.transaction(async (tx) => {
      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(
        sql`insert into "__drizzle_migrations" (hash, created_at) values (${hash}, ${Date.now()})`,
      );
    });

    applied.push(file);
  }

  // Policies are idempotent (DROP ... IF EXISTS + CREATE), so they are applied
  // on every run rather than tracked in the journal.
  await applyRlsPolicies(db);

  return { applied, skipped };
}

/** Apply Row-Level Security policies. Safe to call repeatedly. */
export async function applyRlsPolicies(db: Database): Promise<void> {
  const statements = RLS_POLICIES_SQL.split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
