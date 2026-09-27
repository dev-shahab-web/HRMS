# ASSUMPTIONS & DEFAULTS

Product/technical decisions made where the master spec left them open. Each is a **sensible
production-grade default**; revisit as real requirements land. Format: decision + rationale.

## Toolchain & versions (verified stable at 2026-09-24)

- **TypeScript 7.x** (native Go compiler) for type-checking/builds, ESLint 10.x (flat config),
  Prettier 3.x, Vitest 5.x, Turborepo 2.11.x.
- **TypeScript 7.0 ships no programmatic compiler API yet** (7.1, in `next`, will add one). Tools that
  call the compiler API — notably **typescript-eslint 8.x**, which hard-errors on TS 7.0 — need the
  TS 6.0 API. We use Microsoft's sanctioned **side-by-side aliasing** in the root `package.json`:
  `"@typescript/native": "npm:typescript@^7.0.2"` (provides the native `tsc`, used by `typecheck`)
  and `"typescript": "npm:@typescript/typescript6@^6.0.2"` (provides `tsc6` + the 6.0 API that
  `require('typescript')` resolves to, so typescript-eslint and other API consumers work). Drop the
  alias once typescript-eslint supports TS ≥7.1 (typescript-eslint#10940). `@eslint/js` tracks its own
  line (10.0.x), independent of the `eslint` package version (10.11.x).
- **pnpm 10** workspaces (installed 10.0.0). pnpm 10 blocks lifecycle scripts by default; trusted
  build deps are allow-listed in `pnpm-workspace.yaml` (`onlyBuiltDependencies`).
- **Drizzle ORM 0.45 / drizzle-kit 0.31**, **Hono 4.13**, **Zod 4.6**.
- Node 22 LTS runtime for tooling/tests; Cloudflare Workers runtime (`workerd`) for the API.
- **Internal-source packages:** library packages export TypeScript source (`exports → ./src/index.ts`);
  apps bundle them (Vite/Wrangler transpile TS). No separate build step for libs → simpler, faster,
  no stale `dist`. TS resolves cross-package types via pnpm symlinks + `exports` (bundler resolution).

## Identifiers

- **UUIDv7** primary keys, generated in-app (`newId()` in `@hrms/domain`) via Web Crypto — no DB
  extension, time-ordered for index locality, portable across Postgres providers. Stored as `uuid`.
- Human-facing codes (employee code, requisition id, asset tag) are separate columns, unique **per tenant**.

## Database & environments

- **PostgreSQL** is the system of record. Standard SQL only (no vendor-only extensions at foundation).
- **Local/test DB:** in-process **PGlite** (real Postgres compiled to WASM) — no Docker/`psql` required
  on the dev machine, supports RLS, deterministic for CI. Chosen because Docker is not available locally.
- **Dev/staging/prod DB:** managed PostgreSQL (Neon/Supabase/RDS-class) reached through **Cloudflare
  Hyperdrive** from Workers. `DATABASE_URL` is the only thing the domain sees → provider-portable.
- The DB client factory selects driver by environment: `pglite` (local/test), `postgres-js`
  (Workers/Hyperdrive), `node-postgres` (Node scripts/migrations). Same Drizzle schema for all.
- Environments: `local`, `development`, `staging`, `production`, with separate resources. Env is
  parsed/validated at startup (`@hrms/config`); tests never touch prod resources.

## Multi-tenancy model

- **Single shared database, shared schema, row-level isolation** (not schema-per-tenant, not
  DB-per-tenant). Chosen for cost/operability at thousands of small-to-large tenants; the repository
  abstraction keeps a future move to schema-per-large-tenant possible without domain rewrites.
- Isolation is defense-in-depth (see `docs/architecture/MULTI_TENANCY.md`): column + composite
  constraints + tenant-scoped repositories + Postgres RLS + automated cross-tenant tests.

## Authentication (foundation)

- Identity is **separate** from employment. `users` (login identity) ↔ `tenant_memberships` ↔
  `employees`. One user → many tenants → many roles; employment records are distinct.
- **Password hashing:** PBKDF2-HMAC-SHA-256 via Web Crypto (Workers-native, OWASP-acceptable),
  parameterized iterations, per-user salt, versioned hash string so we can migrate to argon2id (WASM)
  or a dedicated hashing worker later without a data migration. See `docs/ADRs/0004-authentication.md`.
- **Sessions:** server-side session records + signed, httpOnly, Secure, SameSite cookies for web;
  bearer session tokens for mobile/API. Rotation on privilege change; "logout all devices" supported.
- MFA (TOTP), SSO/OIDC, SAML, SCIM are **designed for** (tables/interfaces) but implemented in Phase 1/10.
- We build a lean, standards-based auth behind an `IdentityProvider` interface rather than adopting a
  heavyweight library now, to retain full control over the multi-tenant identity model. Revisit if a
  library (e.g. WorkOS for enterprise SSO/SCIM) proves cheaper than maintaining it.

## Money

- `Money` value object = integer **minor units** (`bigint`) + ISO-4217 currency; all arithmetic on
  integers. Persisted as `numeric(18,4)` + `char(3)` currency. Rounding is explicit per payroll config.

## Time

- All instants `timestamptz` in UTC. IANA tz strings stored where local-time business logic applies.
- Attendance/shift/payroll calculations use the relevant location/company timezone, never server tz.

## Files

- Cloudflare **R2**, private by default, accessed via short-lived signed URLs issued after a
  server-side authorization check. Object key encodes tenant isolation
  (`tenants/{tenantId}/companies/{companyId}/employees/{employeeId}/documents/{documentId}/file`).
  Key obscurity is **never** the authorization mechanism — DB `files` metadata + authz gate every access.

## Localization / i18n

- Initial UI language: **English**. Architecture is i18n-ready (no English strings buried in domain
  logic; message catalogs). Money/date/number formatting is locale-aware. RTL considered later.
- **No India-specific fields are globally mandatory.** Country-specific data (statutory IDs, tax) lives
  in country configuration schemas. First payroll country pack targeted: **IN** (India), then **AE**, **US**
  — each effective-dated and requiring accounting validation before production use.

## Providers (default local implementations)

- Email → console logger; PDF → Cloudflare Browser Rendering (interface allows others); SMS/Push →
  console/Expo; Payments → `manual` (offline invoice) with Stripe/Razorpay adapters behind `PaymentProvider`.

## Scope of this foundation slice

- Phase 0 + the start of Phase 1/2: monorepo, docs, DB foundation (identity/tenant/org/employee/rbac/
  entitlements/audit), migrations, RLS, seed of two isolated tenants, and cross-tenant isolation tests.
  Tenant-scoped repositories are the next foundation slice. Auth service, API, web/mobile shells, and
  Cloudflare deploy config follow. Payroll/attendance/leave engines and their UIs are later phases and
  are **not** claimed done.
