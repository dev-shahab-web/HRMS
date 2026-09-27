import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit is used only to **generate** SQL migrations from the schema
 * (`pnpm db:generate`). Migrations are applied programmatically (PGlite in
 * local/test via the test harness and seed; postgres-js/Hyperdrive in
 * deployed environments) — see `src/client.ts` and `src/migrate.ts`.
 * RLS policies live in `src/rls/policies.ts` and are applied after the
 * generated schema migration.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
