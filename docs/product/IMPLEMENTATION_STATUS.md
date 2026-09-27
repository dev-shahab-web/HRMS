# Implementation Status (Honest)

**A module is never "Production Ready" without tests + completed core workflows** (`CLAUDE.md` §13).
No item is upgraded on the basis of a stub, mock, placeholder, or a button with no action.

Legend: 🔴 Not Started · 🟠 Foundation (schema/skeleton) · 🟡 In Progress · 🟢 Functional (real
end-to-end, some gaps) · ✅ Production Ready (DoD met).

_Last updated: 2026-09-25 (session 3)._

## Phase 0 — Foundation

| Item | Status | Notes |
|---|---|---|
| Monorepo tooling (pnpm/turbo/TS7/eslint/prettier/vitest) | 🟢 | Validated end-to-end: `pnpm install` clean; domain package passes typecheck (TS7 native), lint (ESLint 10 flat + typescript-eslint via TS6 side-by-side), and tests. See `ASSUMPTIONS.md` toolchain note. |
| Architecture & product docs | 🟢 | OVERVIEW, MULTI_TENANCY, AUTHORIZATION, SECURITY, ERD, product docs, CLAUDE.md, ASSUMPTIONS, ADRs. |
| `@hrms/domain` (ids, Money, errors, events, time, pagination) | 🟢 | Implemented + unit-tested (27 tests pass): UUIDv7 ids, `Money` (bigint minor units, exact rounding, no float), typed `DomainError` hierarchy, UTC/tz time helpers, domain events, offset pagination. |
| `@hrms/database` schema (foundation contexts) | 🟢 | Identity, platform, tenant, RBAC, org, employee, custom fields, files, audit schemas are implemented and migrated. |
| Migrations (drizzle-kit + runner) | 🟢 | Generated SQL migration plus programmatic runner. `pnpm --filter @hrms/database db:migrate` verified against local PGlite. |
| PGlite test harness (`@hrms/testing`) | 🟠 | In-package PGlite client + migration harness exists and is used by database tests; shared `@hrms/testing` package not extracted yet. |
| Tenant-scoped repositories | 🔴 | After schema. |
| Cross-tenant isolation tests | 🟢 | 14 RLS tests pass, including read, insert, update, delete, no-tenant fail-closed, role sanity, and policy coverage. |
| Seed: Tenant Alpha + Beta (isolated) | 🟢 | `pnpm --filter @hrms/database seed` verified; creates two tenants with isolated companies and employees. |
| `@hrms/config` (env validation) | 🔴 | |
| `@hrms/permissions` (RBAC catalog + checks) | 🔴 | |
| `@hrms/entitlements` (canUseFeature/limits) | 🔴 | |
| `@hrms/auth` (sessions, password hashing) | 🔴 | |
| `apps/api` (Hono, middleware, first routes) | 🔴 | |
| `apps/web` (React Router shell) | 🔴 | |
| `apps/platform-admin` shell | 🔴 | |
| `apps/mobile` (Expo login shell) | 🔴 | |
| Cloudflare deploy config (wrangler, R2, Hyperdrive) | 🔴 | |
| CI pipeline | 🔴 | |

## Phases 1–10

All 🔴 Not Started (see `IMPLEMENTATION_PLAN.md`). Do not mark otherwise without meeting the DoD.

## Known non-goals right now (explicitly not claimed)

- No payroll/attendance/leave calculations exist yet.
- No live billing integration.
- No deployed environment; wrangler config is scaffolding until credentials + resources exist.
- No backups/DR configured (so none are claimed — `SECURITY.md`).
