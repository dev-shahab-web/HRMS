# Multi-Tenancy & Tenant Isolation

Tenant isolation is the single most important property of this platform. A cross-tenant leak is a
Sev-1 security incident. We use **defense in depth**: five independent layers, any one of which would
catch a mistake in another.

## Model: shared database, shared schema, row-level isolation

- One PostgreSQL database, one schema, tenant rows co-mingled and separated by `tenant_id`.
- Rationale: operationally simple and cost-effective across thousands of tenants of varying size; a
  future move to schema-per-large-tenant is possible behind the repository layer without rewriting
  the domain. (See `docs/ADRs/0003-tenant-isolation-strategy.md`.)

## The `TenantContext`

Resolved **server-side** on every authenticated request and never taken from client input:

```ts
interface TenantContext {
  userId: string;
  tenantId: string;            // the active tenant
  companyIds: string[];        // companies within the tenant the user may access
  membershipId: string;
  roleIds: string[];
  isPlatformAdmin: boolean;    // platform staff acting via an audited path
}
```

The active tenant comes from the session + `tenant_memberships` (and, for multi-tenant users, an
explicit "switch tenant" action that re-validates membership). A `tenant_id` in a URL/body is only
ever a *candidate* that must match the resolved context — mismatches are rejected.

## Layer 1 — Schema: `tenant_id` on every tenant-scoped table

Every tenant-scoped table carries `tenant_id uuid not null references tenants(id)`. Records owned by a
company also carry `company_id`. Platform-global tables (`users`, `plans`, `features`,
`platform_admins`) do not — and are guarded differently.

## Layer 2 — Composite constraints & indexes

- Uniqueness is **always** scoped: `UNIQUE (tenant_id, employee_code)`, `UNIQUE (tenant_id, email)` on
  invitations, etc. A globally-unique business code across tenants is a bug.
- Foreign keys point at rows in the **same tenant**; we additionally validate tenant match in
  repositories (FKs alone don't prevent cross-tenant references if an id is guessed).
- Hot query paths get composite indexes led by `tenant_id` (e.g. `(tenant_id, company_id, status)`).

## Layer 3 — Tenant-scoped repositories (application layer)

The **only** sanctioned way to read/write tenant data is a repository constructed with a
`TenantContext`. It injects `WHERE tenant_id = $ctx.tenantId` into every query and stamps `tenant_id`
on every insert. There is no public repository method that omits the tenant predicate.

```ts
const employees = new EmployeeRepository(db, ctx);
await employees.list({ companyId, page });     // auto-scoped to ctx.tenantId
await employees.findById(id);                  // returns null if row belongs to another tenant
```

Raw `db` access outside repositories is reserved for migrations, seeds, and platform-global tables,
and is called out in review.

## Layer 4 — PostgreSQL Row-Level Security (database backstop)

RLS is the backstop that protects against an application bug forgetting a filter. Every tenant table
has RLS enabled with a policy bound to a per-transaction session variable:

```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

The DB client sets `app.tenant_id` (via `SET LOCAL`) at the start of each tenant-scoped transaction
from the `TenantContext`. Application code cannot set it from raw client input — it flows only from the
server-resolved context. Migrations/seeds run as an owner/bypass role; the **application** connects as a
non-owner role for which `FORCE ROW LEVEL SECURITY` applies.

> Note on PGlite (local/test): RLS is exercised in integration tests against real Postgres semantics.
> Where a given local engine build limits `current_setting`, the repository-layer scoping (Layer 3)
> and the cross-tenant test suite (Layer 5) still fully assert isolation.

## Layer 5 — Automated cross-tenant tests (proof)

`packages/testing` seeds **Tenant Alpha** and **Tenant Beta**. For every module, a test uses Alpha's
credentials/context against Beta's ids and asserts failure (`NotFound`/`Forbidden`, never data):

- employees, documents, payroll, attendance, reports, candidates, settings, files, invoices.

These tests are mandatory in the Definition of Done and run in CI. A new tenant-scoped table without a
cross-tenant test is not "done".

## Platform admin & impersonation

- Platform Admin uses a separate app + separate `platform_admins` identity and audited endpoints.
- Impersonation (support) is **opt-in, reason-required, time-boxed, fully audited**, shows a visible
  banner, and restricts sensitive actions. Unrestricted impersonation is forbidden.

## Review checklist (every PR touching tenant data)

1. New tables have `tenant_id` (+ `company_id` where relevant) and RLS enabled.
2. Unique constraints include `tenant_id`.
3. Data access goes through a tenant-scoped repository (no raw tenant queries).
4. A cross-tenant test covers the new access paths.
5. No `tenant_id` is read from client input as authoritative.
