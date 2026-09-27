# Architecture Overview

## Product shape

A configurable, multi-tenant HRMS SaaS with three front-ends over one API:

- **Web app** (`apps/web`) — tenant-facing (HR, Manager, Employee Self-Service).
- **Mobile app** (`apps/mobile`) — Expo/React Native, employee-centric (check-in, leave, payslips…).
- **Platform Admin** (`apps/platform-admin`) — SaaS control plane (tenants, plans, entitlements).

All three consume the same versioned REST API (`apps/api`). No front-end talks to the DB directly.

## Hierarchy

```
Platform
└── Tenant (customer account, e.g. "ABC Group")
    └── Company / Legal Entity (e.g. "ABC Technologies Pvt Ltd", "ABC UAE LLC")
        ├── Business Unit → Division → Department → Sub-department → Team
        ├── Location (with timezone, geofence)
        ├── Cost Centre
        └── Employees (employment records)
```

A **user** (login identity) is orthogonal to this tree: it gains access via `tenant_memberships`
and `company_access`, and may map to zero or more `employees`.

## Runtime topology (Cloudflare-first)

```
                         ┌─────────────────────────────┐
  Browser / Mobile ───▶  │  apps/api  (Hono @ Workers)  │
                         │  authN · authZ · entitlement │
                         │  validation · services       │
                         └───────┬───────────────┬──────┘
                                 │               │
                     Hyperdrive  │               │ bindings
                                 ▼               ▼
                        ┌──────────────┐   ┌───────────────────────────────┐
                        │ PostgreSQL   │   │ R2 (files)  KV (cache/config) │
                        │ (RLS + repos)│   │ Queues (async)  Workflows      │
                        └──────────────┘   │ Turnstile  Browser Rendering   │
                                           └───────────────────────────────┘
                                 ▲
              apps/worker-jobs   │  (queue/workflow consumers: email, PDF,
              (Workers)  ────────┘   imports, exports, payroll side-jobs)
```

- **Workers** run API + server logic. **Hyperdrive** pools/accelerates Postgres from Workers.
- **R2** stores documents/payslips/exports (private, signed access).
- **Queues** run async tasks; **Workflows** run durable multi-step processes (onboarding, payroll,
  offboarding, approvals). **KV** caches non-authoritative config only (never source of truth).
- **Turnstile** guards signup/login/reset. **Browser Rendering** renders HTML→PDF.

## Domain architecture: modular monolith

We start as a **modular monolith** with clean bounded contexts, not microservices. Deployment stays
simple (a few Workers); module boundaries are enforced in code (`packages/*`) so a context can be
extracted into its own service later if scale demands it.

Bounded contexts: **Platform · Identity · Tenant · Organization · Employee · Recruitment ·
Attendance · Leave · Timesheets · Payroll · Documents · Approvals · Notifications · Billing · Audit**.

### Request lifecycle

```
HTTP request
  → requestId/correlationId assigned (observability)
  → CORS / security headers
  → authentication (session → User)
  → tenant resolution (membership → TenantContext {tenantId, companyIds, roles})
  → route: Zod validation → authorization (permission + data scope)
            → entitlement check (feature/limit) → application service
            → domain service (pure logic) → tenant-scoped repository → Postgres
  → domain events emitted → (notifications / webhooks / audit / workflows)
  → structured response (or mapped domain error)
```

HTTP handlers are thin orchestrators. Business rules live in `packages/*` and are unit-testable
without HTTP.

## Package dependency direction

```
apps/*  ──▶  packages/*        (apps depend on packages; never the reverse)

domain ◀── validation, permissions, entitlements, payroll-engine, attendance-engine, documents
database ──▶ domain            (repositories return/accept domain types)
auth ──▶ database, domain
config, observability, design-tokens  → leaf utilities
ui ──▶ design-tokens           (web only; not shared with React Native components)
api-client ──▶ validation      (shared request/response contracts)
```

`@hrms/domain` is framework-free (no Hono, no React, no Drizzle). It holds value objects (`Money`,
`Email`, timezone helpers), domain errors, domain events, and pure calculation contracts.

## Portability strategy

Cloudflare-optimized **today**, portable **later**: every external dependency sits behind an
interface — `StorageProvider` (R2→S3), `QueueProvider` (Queues→SQS/Kafka), `WorkflowProvider`
(Workflows→Temporal/Step Functions), `PdfProvider`, `EmailProvider`, `PaymentProvider`,
`IdentityProvider`, `KmsProvider`. The domain never imports a vendor SDK directly. `DATABASE_URL`
is the only database coupling, so the DB can move between managed Postgres providers freely.

## Related docs

- Multi-tenancy & isolation — `docs/architecture/MULTI_TENANCY.md`
- Authorization (RBAC + scopes) — `docs/architecture/AUTHORIZATION.md`
- Security — `docs/architecture/SECURITY.md`
- Data model — `docs/database/ERD.md`
- Decisions — `docs/ADRs/`
