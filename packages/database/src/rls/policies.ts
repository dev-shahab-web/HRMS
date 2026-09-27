/**
 * Row-Level Security policies — defense-in-depth layer 4 (CLAUDE.md §1).
 *
 * Layers 1–3 (the `tenant_id` column, tenant-scoped unique constraints, and
 * tenant-scoped repositories) are all application discipline: they hold as long
 * as every developer remembers them. This layer does not depend on anyone
 * remembering. If a query reaches Postgres without a tenant predicate, the
 * policy adds one — and if the session has no tenant set, it matches **zero
 * rows** rather than all of them.
 *
 * Key mechanics, and why each one is here:
 *
 * - **`FORCE ROW LEVEL SECURITY`** — plain `ENABLE` exempts the table owner.
 *   Since the application role typically owns these tables, `ENABLE` alone
 *   would mean the app silently bypasses every policy. `FORCE` closes that.
 * - **`current_setting('app.tenant_id', true)`** (via `app_current_tenant()`)
 *   — the `true` = "don't error if unset", so a missing setting yields `NULL`,
 *   and `tenant_id = NULL` is never true. Fail closed, not fail open.
 * - **Superusers and `BYPASSRLS` roles are NEVER subject to policies**, even
 *   with `FORCE`. This is why the test suite `SET ROLE`s to the non-superuser
 *   `hrms_app` role — testing isolation as a superuser would pass vacuously
 *   and prove nothing. See `src/__tests__/tenant-isolation.test.ts`.
 * - Policies appear in pairs where they can (`USING` filters reads, `WITH
 *   CHECK` filters writes), so a tenant cannot *write* a row belonging to
 *   another tenant either — not just fail to read one.
 */

/**
 * Install the tenant helper and the non-superuser application role.
 *
 * The role is created here so local/dev/test environments are set up by the
 * same code path that production uses. `CREATE ROLE` needs superuser, and is
 * idempotent, so it is guarded rather than assumed.
 */
const RLS_BOOTSTRAP_SQL = /* sql */ `
create or replace function app_current_tenant() returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
--> statement-breakpoint

-- The tenant-scoped guard: true only when the row belongs to the session's tenant.
create or replace function app_tenant_matches(row_tenant_id uuid) returns boolean
language sql
stable
as $$
  select row_tenant_id is not null
     and row_tenant_id = app_current_tenant()
$$;
--> statement-breakpoint

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hrms_app') then
    -- NOSUPERUSER + NOBYPASSRLS are the point: this role IS subject to RLS.
    create role hrms_app nologin nosuperuser nobypassrls;
  end if;
end
$$;
--> statement-breakpoint

grant usage on schema public to hrms_app;
--> statement-breakpoint

grant select, insert, update, delete on all tables in schema public to hrms_app;
--> statement-breakpoint

grant usage, select on all sequences in schema public to hrms_app;
--> statement-breakpoint

-- The audit trail is append-only: read it and add to it, never rewrite it.
revoke update, delete on "audit_events" from hrms_app;
--> statement-breakpoint
`;

/** `tenant_id = app_current_tenant()`, with both read and write guards. */
function isolate(table: string): string {
  return `
alter table "${table}" enable row level security;
--> statement-breakpoint
alter table "${table}" force row level security;
--> statement-breakpoint
drop policy if exists ${table}_tenant_isolation on "${table}";
--> statement-breakpoint
create policy ${table}_tenant_isolation on "${table}"
  using (app_tenant_matches(tenant_id))
  with check (app_tenant_matches(tenant_id));
--> statement-breakpoint
`;
}

/**
 * Tables carrying a non-nullable `tenant_id` — the straightforward case.
 * Listed explicitly rather than derived, so adding a table without a policy is
 * a visible omission in a diff rather than an invisible one at runtime.
 */
const DIRECT_TENANT_TABLES = [
  // Tenant context
  'invitations',
  'subscriptions',
  'tenant_entitlement_overrides',
  'tenant_memberships',
  'company_access',
  // Files
  'files',
  // RBAC
  'member_roles',
  // Organization
  'companies',
  'business_units',
  'departments',
  'locations',
  'cost_centres',
  'designations',
  'job_levels',
  'employment_types',
  'teams',
  // Employee
  'employees',
  'employment_records',
  'employee_addresses',
  'employee_contacts',
  'emergency_contacts',
  'dependents',
  'employee_bank_accounts',
  'employee_gov_ids',
  // Custom fields
  'custom_field_definitions',
  'custom_field_values',
] as const;

/**
 * `tenants` is the tenant root: the row IS the tenant, so the predicate is on
 * `id` rather than a `tenant_id` column. A tenant session can see exactly one
 * tenant row — its own — which also means it cannot enumerate other customers.
 */
const TENANTS_SQL = `
alter table "tenants" enable row level security;
--> statement-breakpoint
alter table "tenants" force row level security;
--> statement-breakpoint
drop policy if exists tenants_self_isolation on "tenants";
--> statement-breakpoint
create policy tenants_self_isolation on "tenants"
  using (id = app_current_tenant())
  with check (id = app_current_tenant());
--> statement-breakpoint
`;

/**
 * `roles` is the one table with a **nullable** `tenant_id`: `NULL` marks a
 * global system template (`hr_admin`, `employee`, …) that every tenant reads
 * but none may modify.
 *
 * Two permissive policies, which Postgres ORs together:
 *   - read the tenant's own roles, or any system template;
 *   - write only the tenant's own roles.
 *
 * A tenant therefore cannot edit or delete a system role, because no policy
 * grants a write on a `NULL`-tenant row.
 */
const ROLES_SQL = `
alter table "roles" enable row level security;
--> statement-breakpoint
alter table "roles" force row level security;
--> statement-breakpoint
drop policy if exists roles_read_own_or_system on "roles";
--> statement-breakpoint
create policy roles_read_own_or_system on "roles"
  for select
  using (tenant_id is null or app_tenant_matches(tenant_id));
--> statement-breakpoint
drop policy if exists roles_write_own on "roles";
--> statement-breakpoint
create policy roles_write_own on "roles"
  for all
  using (app_tenant_matches(tenant_id))
  with check (app_tenant_matches(tenant_id));
--> statement-breakpoint
`;

/**
 * `role_permissions` has no `tenant_id` of its own — it is scoped through its
 * role. The predicate therefore delegates, and `roles`' own policy applies to
 * the subquery, so the system-vs-tenant distinction is decided in exactly one
 * place rather than duplicated and able to drift.
 */
const ROLE_PERMISSIONS_SQL = `
alter table "role_permissions" enable row level security;
--> statement-breakpoint
alter table "role_permissions" force row level security;
--> statement-breakpoint
drop policy if exists role_permissions_role_isolation on "role_permissions";
--> statement-breakpoint
create policy role_permissions_role_isolation on "role_permissions"
  using (exists (select 1 from "roles" r where r.id = role_permissions.role_id))
  with check (exists (
    select 1 from "roles" r
    where r.id = role_permissions.role_id
      and app_tenant_matches(r.tenant_id)
  ));
--> statement-breakpoint
`;

/**
 * `audit_events.tenant_id` is nullable: platform-level actions (suspending a
 * tenant, editing a plan) have no tenant. Tenant sessions see and write only
 * their own rows; platform rows are invisible to them. There is deliberately
 * **no UPDATE or DELETE policy**, so with RLS enabled those commands match no
 * rows at all — immutability enforced by the database, not by convention.
 */
const AUDIT_SQL = `
alter table "audit_events" enable row level security;
--> statement-breakpoint
alter table "audit_events" force row level security;
--> statement-breakpoint
drop policy if exists audit_events_read_own on "audit_events";
--> statement-breakpoint
create policy audit_events_read_own on "audit_events"
  for select
  using (app_tenant_matches(tenant_id));
--> statement-breakpoint
drop policy if exists audit_events_append_own on "audit_events";
--> statement-breakpoint
create policy audit_events_append_own on "audit_events"
  for insert
  with check (app_tenant_matches(tenant_id));
--> statement-breakpoint
`;

/**
 * Full policy script. Applied by `applyRlsPolicies` after every migration run.
 * Every statement is idempotent, so this is safe to re-run against a live DB.
 */
export const RLS_POLICIES_SQL = [
  RLS_BOOTSTRAP_SQL,
  TENANTS_SQL,
  ROLES_SQL,
  ROLE_PERMISSIONS_SQL,
  AUDIT_SQL,
  ...DIRECT_TENANT_TABLES.map(isolate),
].join('');

/**
 * Tables that intentionally carry **no** RLS, with the reason. Exported so a
 * test can assert the list matches reality — a newly added global table must be
 * added here deliberately, which makes "I forgot the policy" fail loudly.
 */
export const GLOBAL_TABLES_WITHOUT_RLS: Readonly<Record<string, string>> = {
  users: 'Global login identity; a person may belong to many tenants (CLAUDE.md §1, §2).',
  user_credentials: 'Global; reached only through its user, in the auth path.',
  user_identities: 'Global; external IdP links (OIDC/SAML).',
  mfa_factors: 'Global; per-user authentication factors.',
  sessions: 'Global; a session exists before a tenant is selected.',
  login_audit: 'Global; authentication happens before tenant context exists.',
  platform_admins: 'SaaS staff; global by definition.',
  plans: 'Global SaaS catalog.',
  features: 'Global SaaS catalog.',
  plan_entitlements: 'Global SaaS catalog.',
  permissions: 'Global capability catalog, seeded from @hrms/permissions.',
};
