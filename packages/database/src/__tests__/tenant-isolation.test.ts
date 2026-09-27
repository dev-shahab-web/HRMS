/**
 * Cross-tenant isolation — the mandatory test from CLAUDE.md §1 and §13.
 *
 * This is the load-bearing test of the entire multi-tenancy design. It proves
 * that a bug in the layers above (a forgotten `where tenant_id = ?`, a
 * hand-written query, a future contributor who has never read CLAUDE.md) still
 * cannot leak one tenant's data into another tenant's request.
 *
 * **Why `set local role hrms_app` is not optional here.** Postgres exempts
 * superusers and roles with `BYPASSRLS` from every policy, even with `FORCE
 * ROW LEVEL SECURITY`. PGlite connects as a superuser, so running these
 * assertions without dropping into the application role would pass while
 * proving nothing. `hrms_app` is created `NOSUPERUSER NOBYPASSRLS`
 * specifically so that the policies apply to it.
 *
 * A cross-tenant attempt must fail. Silently returning zero rows is the
 * *correct* outcome for a read (the row is invisible), and a policy violation
 * is the correct outcome for a write.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { newId } from '@hrms/domain';

import { createPgliteDatabase, rawQuery, type Database } from '../client';
import { migrateDatabase } from '../migrate';

let db: Database;

/** Ids created in setup, as the superuser, so the tests can target them. */
const ids = {
  alphaTenant: '',
  betaTenant: '',
  alphaCompany: '',
  betaCompany: '',
  alphaEmployee: '',
  betaEmployee: '',
};

/** Run `fn` as the non-superuser app role with a tenant selected. */
async function asTenant<T>(
  tenantId: string | null,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw('set local role hrms_app'));
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

function collectErrorMessages(error: unknown): string[] {
  if (!(error instanceof Error)) return [String(error)];

  const messages = [error.message];
  if ('cause' in error && error.cause != null) {
    messages.push(...collectErrorMessages(error.cause));
  }
  return messages;
}

async function expectRlsViolation(promise: Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }

  expect(caught, 'expected the database to reject a cross-tenant write').toBeDefined();
  expect(collectErrorMessages(caught).join('\n')).toMatch(/row-level security/i);
}

async function seedTenant(slug: string, employeeCode: string) {
  const tenantId = newId();
  const tenant = await rawQuery<{ id: string }>(
    db,
    sql`insert into tenants (id, name, slug, status)
        values (${tenantId}, ${slug}, ${slug}, 'active') returning id`,
  );

  const companyId = newId();
  const company = await rawQuery<{ id: string }>(
    db,
    sql`insert into companies (id, tenant_id, legal_name, code, country, timezone, currency, status)
        values (${companyId}, ${tenant[0]!.id}, ${slug}, 'C1', 'IN', 'Asia/Kolkata', 'INR', 'active')
        returning id`,
  );

  const employeeId = newId();
  const employee = await rawQuery<{ id: string }>(
    db,
    sql`insert into employees (id, tenant_id, company_id, employee_code, first_name, last_name,
                               status, date_of_joining)
        values (${employeeId}, ${tenant[0]!.id}, ${company[0]!.id}, ${employeeCode}, 'Test', ${slug}, 'active', '2025-01-01')
        returning id`,
  );

  return { tenantId: tenant[0]!.id, companyId: company[0]!.id, employeeId: employee[0]!.id };
}

beforeAll(async () => {
  db = await createPgliteDatabase();
  await migrateDatabase(db);

  // Seeded as the superuser on purpose: setup must be able to write rows for
  // both tenants. The assertions below are the part that runs as `hrms_app`.
  const alpha = await seedTenant('alpha', 'A001');
  const beta = await seedTenant('beta', 'B001');

  ids.alphaTenant = alpha.tenantId;
  ids.betaTenant = beta.tenantId;
  ids.alphaCompany = alpha.companyId;
  ids.betaCompany = beta.companyId;
  ids.alphaEmployee = alpha.employeeId;
  ids.betaEmployee = beta.employeeId;
}, 60_000);

afterAll(async () => {
  await (db as unknown as { $client?: { close?: () => Promise<void> } }).$client?.close?.();
});

describe('row-level security is actually enforced', () => {
  it('runs the assertions as a role that RLS applies to', async () => {
    // Guard against the test itself becoming vacuous: if someone later seeds as
    // hrms_app, or PGlite starts connecting as a non-superuser, this catches it.
    const [role] = await asTenant(null, (tx) =>
      rawQuery<{ current_user: string; is_super: boolean; bypassrls: boolean }>(
        tx,
        sql`select current_user,
                   (select rolsuper from pg_roles where rolname = current_user) as is_super,
                   (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls`,
      ),
    );

    expect(role!.current_user).toBe('hrms_app');
    expect(role!.is_super).toBe(false);
    expect(role!.bypassrls).toBe(false);
  });

  it('the app role does not own the tables, so FORCE is not silently redundant', async () => {
    const [ownership] = await asTenant(ids.alphaTenant, (tx) =>
      rawQuery<{ owned: number }>(
        tx,
        sql`select count(*)::int as owned
            from pg_tables t
            join pg_roles r on r.rolname = t.tableowner
            where t.schemaname = 'public' and r.rolname = 'hrms_app'`,
      ),
    );

    expect(ownership!.owned).toBe(0);
  });
});

describe('reads are scoped to the session tenant', () => {
  it('tenant A sees only its own employees', async () => {
    const rows = await asTenant(ids.alphaTenant, (tx) =>
      rawQuery<{ id: string; tenant_id: string }>(tx, sql`select id, tenant_id from employees`),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(ids.alphaEmployee);
    expect(rows[0]!.tenant_id).toBe(ids.alphaTenant);
  });

  it('tenant B sees only its own employees — the mirror case', async () => {
    const rows = await asTenant(ids.betaTenant, (tx) =>
      rawQuery<{ id: string }>(tx, sql`select id from employees`),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(ids.betaEmployee);
  });

  it('a direct lookup of the other tenant row by primary key returns nothing', async () => {
    // The strongest form of the read test: the caller already knows the exact
    // id. Guessing an id must not be a way around the tenant predicate.
    const rows = await asTenant(ids.alphaTenant, (tx) =>
      rawQuery<{ id: string }>(tx, sql`select id from employees where id = ${ids.betaEmployee}`),
    );

    expect(rows).toHaveLength(0);
  });

  it('a tenant cannot enumerate other tenants', async () => {
    const rows = await asTenant(ids.alphaTenant, (tx) =>
      rawQuery<{ id: string }>(tx, sql`select id from tenants`),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(ids.alphaTenant);
  });

  it('with no tenant set, a tenant-scoped table yields zero rows (fail closed)', async () => {
    // This is the case that matters most: a request that reaches the database
    // without a tenant context must see nothing, not everything.
    for (const table of ['employees', 'companies', 'tenants', 'employment_records', 'files']) {
      const rows = await asTenant(null, (tx) =>
        rawQuery<{ id: string }>(tx, sql`select id from ${sql.raw(`"${table}"`)}`),
      );
      expect(rows, `${table} leaked rows without a tenant context`).toHaveLength(0);
    }
  });

  it('an explicit cross-tenant filter still cannot widen the result set', async () => {
    // Belt and braces: even asking for the other tenant's rows by name fails.
    const rows = await asTenant(ids.alphaTenant, (tx) =>
      rawQuery<{ id: string }>(
        tx,
        sql`select id from employees where tenant_id = ${ids.betaTenant}`,
      ),
    );

    expect(rows).toHaveLength(0);
  });
});

describe('writes cannot cross the tenant boundary', () => {
  it('tenant A cannot insert a row belonging to tenant B', async () => {
    await expectRlsViolation(
      asTenant(ids.alphaTenant, (tx) =>
        rawQuery(
          tx,
          sql`insert into employees (id, tenant_id, company_id, employee_code, first_name, last_name,
                                     status, date_of_joining)
              values (${newId()}, ${ids.betaTenant}, ${ids.betaCompany}, 'EVIL-1', 'Bad', 'Actor',
                      'active', '2025-01-01')
              returning id`,
        ),
      ),
    );
  });

  it('tenant A cannot move one of its rows into tenant B', async () => {
    // An UPDATE that re-homes a row is as dangerous as an insert; the policy's
    // WITH CHECK clause is what stops it.
    await expectRlsViolation(
      asTenant(ids.alphaTenant, (tx) =>
        rawQuery(
          tx,
          sql`update employees set tenant_id = ${ids.betaTenant}
              where id = ${ids.alphaEmployee}`,
        ),
      ),
    );
  });

  it('tenant A cannot update a row it cannot see', async () => {
    // Zero rows affected — the row is invisible to the USING clause, so the
    // statement is a silent no-op rather than an error. Both outcomes are safe;
    // what must never happen is the update landing.
    await asTenant(ids.alphaTenant, (tx) =>
      rawQuery(
        tx,
        sql`update employees set first_name = 'Hijacked' where id = ${ids.betaEmployee}`,
      ),
    );

    const [row] = await asTenant(ids.betaTenant, (tx) =>
      rawQuery<{ first_name: string }>(
        tx,
        sql`select first_name from employees where id = ${ids.betaEmployee}`,
      ),
    );

    expect(row!.first_name).not.toBe('Hijacked');
  });

  it('tenant A cannot delete another tenant row', async () => {
    await asTenant(ids.alphaTenant, (tx) =>
      rawQuery(tx, sql`delete from employees where id = ${ids.betaEmployee}`),
    );

    const rows = await asTenant(ids.betaTenant, (tx) =>
      rawQuery<{ id: string }>(tx, sql`select id from employees where id = ${ids.betaEmployee}`),
    );

    expect(rows).toHaveLength(1);
  });
});

describe('policy coverage', () => {
  it('every tenant-scoped table has RLS enabled and forced', async () => {
    const rows = await rawQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      db,
      sql`select c.relname, c.relrowsecurity, c.relforcerowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and c.relname <> '__drizzle_migrations'
          order by c.relname`,
    );

    const unprotected = rows
      .filter((row) => !row.relrowsecurity || !row.relforcerowsecurity)
      .map((row) => row.relname);

    // `tenants` is protected but keyed on `id`; everything else that is
    // unprotected must be accounted for in the global-table allow-list.
    const { GLOBAL_TABLES_WITHOUT_RLS } = await import('../rls/policies');
    const unexplained = unprotected.filter((name) => !(name in GLOBAL_TABLES_WITHOUT_RLS));

    expect(unexplained, 'tables with no RLS and no documented reason').toEqual([]);
  });

  it('every table has at least one policy unless it is deliberately global', async () => {
    const rows = await rawQuery<{ tablename: string; policies: number }>(
      db,
      sql`select t.tablename, count(p.policyname)::int as policies
          from pg_tables t
          left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
          where t.schemaname = 'public' and t.tablename <> '__drizzle_migrations'
          group by t.tablename`,
    );

    const { GLOBAL_TABLES_WITHOUT_RLS } = await import('../rls/policies');
    const missing = rows
      .filter((row) => row.policies === 0)
      .map((row) => row.tablename)
      .filter((name) => !(name in GLOBAL_TABLES_WITHOUT_RLS));

    expect(missing, 'tenant tables with no policy at all').toEqual([]);
  });
});
