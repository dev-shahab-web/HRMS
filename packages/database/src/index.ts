/**
 * `@hrms/database` — schema, client, migrations, and tenant context helpers.
 *
 * This package is the **only** sanctioned path to tenant data (CLAUDE.md §1).
 * Application code should run tenant-scoped work through `withTenantContext`.
 * Repositories are the next foundation slice and should wrap that helper rather
 * than accepting tenant ids from client payloads.
 */

export * as schema from './schema';
export * from './client';
export * from './migrate';

export { RLS_POLICIES_SQL, GLOBAL_TABLES_WITHOUT_RLS } from './rls/policies';
