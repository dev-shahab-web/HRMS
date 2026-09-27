# ADR-0003: Tenant isolation strategy

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Isolation between thousands of tenants is the platform's most critical property. Options: (a) database
per tenant, (b) schema per tenant, (c) shared schema with row-level `tenant_id`.

## Decision

**Shared database, shared schema, row-level isolation** with **defense in depth** (see
`docs/architecture/MULTI_TENANCY.md`): `tenant_id` on every tenant table + tenant-scoped composite
uniqueness + tenant-scoped repositories (only sanctioned data path) + PostgreSQL RLS backstop +
mandatory automated cross-tenant tests.

Rationale for (c) over (a)/(b): operational simplicity and cost at thousands of tenants (connection
pool limits under Workers/Hyperdrive make DB/schema-per-tenant impractical at this cardinality),
straightforward migrations, and good-enough isolation via layered controls. The repository abstraction
preserves the option to promote a very large tenant to its own schema/DB later without domain rewrites.

## Consequences

- Every tenant-scoped query MUST pass through a repository carrying a server-resolved `TenantContext`.
- RLS requires the app to connect as a non-owner role with `FORCE ROW LEVEL SECURITY`, and to set
  `app.tenant_id` via `SET LOCAL` per tenant transaction. Migrations/seeds use an owner/bypass role.
- Noisy-neighbor and per-tenant data-residency needs are handled later via pooling/sharding, not by
  changing the domain model.
