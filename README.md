# HRMS SaaS Platform

A production-grade, multi-tenant, configurable **Human Resource Management System** delivered as a
SaaS platform. Web + mobile (Android/iOS) + Platform Admin, built Cloudflare-first with a portable
domain layer.

> ⚠️ **Status: Foundation in progress.** See [`docs/product/IMPLEMENTATION_STATUS.md`](docs/product/IMPLEMENTATION_STATUS.md)
> for the honest, per-module status. Nothing here is marked "done" without tests and real workflows.

## What this is

A configurable HRMS comparable in scope to Keka / Darwinbox / BambooHR / Zoho People — Core HR,
Attendance & Geofencing, Leave, Timesheets, Recruitment/ATS, Payroll & Tax, Documents, Performance,
Assets, Expenses, plus a SaaS control plane (tenants, plans, entitlements, billing).

## Architecture at a glance

- **Monorepo:** pnpm workspaces + Turborepo, TypeScript (strict).
- **Backend:** Hono on Cloudflare Workers, PostgreSQL (Drizzle ORM), Hyperdrive, R2, Queues, Workflows.
- **Web:** React + React Router (full-stack) + Vite on Workers, Tailwind, TanStack Query/Table.
- **Mobile:** Expo / React Native (one codebase for Android + iOS).
- **Multi-tenancy:** defense-in-depth isolation (tenant_id everywhere + composite constraints +
  tenant-scoped repositories + PostgreSQL Row-Level Security + automated cross-tenant tests).

See [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) for the full picture and
[`CLAUDE.md`](CLAUDE.md) for the non-negotiable engineering rules.

## Repository layout

```
apps/
  web/            React Router full-stack app (tenant-facing)
  platform-admin/ SaaS super-admin app
  api/            Hono API on Cloudflare Workers
  worker-jobs/    Queue/Workflow consumers (async jobs)
  mobile/         Expo React Native app
packages/
  database/       Drizzle schema, migrations, tenant-scoped repositories, seed
  domain/         Framework-free domain model, value objects, domain errors, events
  validation/     Shared Zod schemas (request/response contracts)
  permissions/    RBAC: permissions catalog, roles, data scopes, policy checks
  entitlements/   SaaS plans, features, limits, enforcement APIs
  auth/           Authentication/session logic (identity, not employment)
  payroll-engine/ Isolated payroll calculation subsystem + country packs
  attendance-engine/ Attendance/shift calculation
  documents/      Template + PDF generation engine (provider interface)
  config/         Runtime env parsing/validation
  observability/  Structured logging, request IDs, telemetry hooks
  ui/             Web design system (shadcn/Radix based)
  design-tokens/  Shared brand tokens (web + mobile)
  api-client/     Typed API client generated from the OpenAPI contract
  testing/        Shared test utilities (PGlite harness, tenant fixtures)
docs/             Architecture, product, database, ADRs
infrastructure/   Cloudflare (wrangler) config, migration & deploy scripts
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:generate     # generate SQL migrations from the Drizzle schema
pnpm db:migrate      # apply migrations (uses PGlite locally if no DATABASE_URL)
pnpm seed            # seed two isolated demo tenants (Alpha + Beta)
pnpm dev             # start apps
```

## Quality gates

```bash
pnpm typecheck   # TypeScript, strict, across all packages
pnpm lint        # ESLint (type-aware)
pnpm test        # unit tests (Vitest)
pnpm test:integration  # DB + API + cross-tenant isolation tests
```

## License

Proprietary — all rights reserved (placeholder; finalize before any distribution).
