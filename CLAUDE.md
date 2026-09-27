# CLAUDE.md — Engineering Rules for HRMS SaaS

> This file governs **every** Claude Code session and human contributor in this repo.
> These rules are non-negotiable. When a rule here conflicts with a convenient shortcut, the rule wins.
> If you believe a rule is wrong, change it here in a PR with justification — do not silently ignore it.

## 0. The two questions to ask before writing any code

1. **"Will this still be correct when 5,000 unrelated companies share this platform?"**
2. **"Could a bug here expose one tenant's employees, payroll, documents, or attendance to another tenant?"**

If the answer to (2) is *maybe*, stop and redesign before continuing.

## 1. Multi-tenancy (the highest-priority rule)

- **Every tenant-scoped table has a `tenant_id` column** (and `company_id` where the record belongs to a company).
- **Never trust a tenant id from the client.** Tenant context is derived **server-side** from the authenticated session/membership and passed explicitly as a `TenantContext`.
- **No tenant-scoped query may run without a tenant filter.** In application code you MUST go through a tenant-scoped repository that injects `tenant_id`. A raw `SELECT * FROM employees` without a tenant predicate is a **bug and a security incident**.
- **Defense in depth is mandatory** (all layers, not one):
  1. `tenant_id` column on every tenant table.
  2. Composite unique constraints always include `tenant_id` (e.g. `UNIQUE (tenant_id, employee_code)`).
  3. Tenant-scoped repositories in `@hrms/database` — the only sanctioned data access path for tenant data.
  4. PostgreSQL **Row-Level Security** policies keyed on the `app.tenant_id` session setting.
  5. Automated cross-tenant leakage tests for every module (`packages/testing` fixtures: Tenant Alpha vs Beta).
- A person (`user`) is **not** a tenant. Users belong to tenants via `tenant_memberships` and may belong to many.

## 2. Data model distinctions (never conflate)

`user` ≠ `employee` · `tenant` ≠ `company` · `attendance_event` ≠ `attendance_day` · `payroll_run` ≠ `payslip` · `candidate` ≠ `employee` · `salary_structure` ≠ `employee_compensation` · `leave_ledger` ≠ `leave_request` · `document_template` ≠ `generated_document` · `plan` ≠ `entitlement`.

## 3. Layering — HTTP handlers are thin

```
HTTP route → input validation (Zod) → authN (session) → authZ (permission + scope)
          → entitlement check → application service → domain service → repository → DB
```

- No business logic in route handlers. No SQL in route handlers. No payroll math in controllers.
- Domain logic lives in `packages/*` and must be unit-testable **without** HTTP or a live DB where possible.
- Route handler max ~80 lines. If longer, extract a service.

## 4. Authorization

- **Server-side always.** UI hiding is a UX affordance, never a security control.
- RBAC with fine-grained **permission capabilities** (`employee.compensation.read`, `payroll.approve`, …), not `role === 'admin'`.
- **Data scopes** (`self`, `direct_reports`, `department`, `company`, `tenant`, …) constrain *which rows* a permission applies to.
- Every mutation endpoint checks a permission. Every read of sensitive PII (compensation, bank, gov IDs) checks a field-level permission. No copy-pasted ad-hoc checks — use `@hrms/permissions`.

## 5. Entitlements (SaaS)

- Feature access is **not** hardcoded by plan name. Use `@hrms/entitlements`: `canUseFeature()`, `getFeatureLimit()`, `checkUsageLimit()`.
- Enforcement is **server-side**. Disabling a menu item is not enforcement.
- Engineering feature flags (beta rollouts) are a **different** concept from subscription entitlements. Keep them separate.

## 6. Money & time (correctness)

- **Money:** never floating point. Use the `Money` value object (integer minor units + ISO currency) in the domain; store as `numeric(18,4)` in the DB. Rounding strategy is explicit and configurable.
- **Time:** store timestamps as `timestamptz` (UTC). Store IANA timezone strings (`Asia/Kolkata`) explicitly where a business calculation needs local time. Never assume server tz == company tz. Shift/attendance math uses the shift/location/company timezone. Payroll periods are date-based business concepts, not UTC instants.

## 7. Identifiers

- Primary keys are **UUIDv7** (time-ordered), generated in the app (`newId()` in `@hrms/domain`). Portable, index-friendly, no DB extension required.
- **Never** use employee email or employee code as a primary key. Human-facing codes (employee code, requisition id) are separate unique columns, scoped by `tenant_id`.

## 8. Database & migrations

- PostgreSQL only. Design must run on **standard** Postgres — avoid vendor-only extensions without a compelling, documented reason.
- Drizzle ORM for schema + queries; **raw SQL is allowed and encouraged** for complex reporting/payroll — do not force the ORM.
- Migrations are version-controlled, reproducible, forward-only in production. No destructive change without an explicit migration + backfill strategy.
- Schema is organized by **bounded context** (identity, tenant, organization, employee, rbac, entitlements, audit, …). No single giant schema file.
- Add proper PKs, FKs, indexes, composite indexes, unique constraints, and check constraints. Avoid N+1.

## 9. Auditing

- Sensitive mutations write an immutable `audit_event` (actor, tenant, company, action, entity, before/after, request id, ip, source, timestamp).
- **Never** put passwords, tokens, full bank numbers, or raw government IDs into audit logs, logs, or telemetry. Mask sensitive fields.

## 10. Errors

- Use typed **domain errors** (`TenantNotFound`, `Forbidden`, `FeatureNotEnabled`, `PayrollAlreadyLocked`, `AttendanceOutsideGeofence`, `LeaveBalanceInsufficient`, …). Never throw bare strings.
- API maps domain errors → structured responses: `{ error: { code, message, requestId, details } }`. Never leak stack traces or internals to clients.

## 11. Background work, idempotency, concurrency

- Long/expensive work (exports, PDF batches, imports, bulk notifications, payroll side jobs) goes to **Queues/Workflows**, never a synchronous HTTP request.
- Financial/workflow endpoints are **idempotent** (idempotency keys). Retries must not double-apply side effects.
- Protect finalize-once operations (payroll lock, offer accept) with transactions + optimistic version columns.

## 12. Providers behind interfaces

- External services (email, storage, PDF, payments, SMS, push, e-sign, identity) live behind interfaces so Cloudflare-first today can move to AWS/GCP later. No `stripe.` calls sprinkled through the domain.

## 13. Testing (Definition of Done includes tests)

- Unit-test payroll, attendance, leave, permissions, entitlements, formula engine.
- Integration-test DB, API, approval flows, and **tenant boundaries**.
- **Mandatory:** for each module, a cross-tenant test proves Tenant A credentials cannot touch Tenant B ids (employees, docs, payroll, attendance, reports, candidates, settings, files, invoices). All such attempts must fail with `Forbidden`/`NotFound`.
- E2E critical web flows with Playwright. Never use production DB/R2 in tests.
- A module is **Production Ready** only with: model + migrations + domain + API + validation + authZ + tenant isolation + entitlement (if relevant) + audit + UI (loading/error/empty) + tests + docs + seed. See `docs/product/IMPLEMENTATION_STATUS.md`.

## 14. Never fake completion

Do not claim something works when only an interface, mock, placeholder, TODO, or a button with no action exists. Track true status. Use TODO comments sparingly and always with context.

## 15. Dependencies

Before adding one, confirm: actively maintained? works in Cloudflare Workers? no adequate Web API alternative? actually needed? not a security/bundle risk? Prefer few high-quality deps. Verify latest stable versions before pinning.

## 16. Cloudflare Workers compatibility

Backend runs in Workers. Prefer Web APIs (`crypto`, `fetch`, `URL`). Use `nodejs_compat` only when required and verify the API is supported. Do not assume a Node built-in is available.

## 17. Style & structure

- TypeScript strict; no uncontrolled `any`; explicit domain types; small focused functions.
- No god classes, no 1,000-line handlers, no duplicated business logic, no magic strings, no copy-pasted authz, no frontend-only access control.
- Packages never depend on app code. Apps depend on packages. Enforce dependency direction.
- Config over customization: leave policy, shifts, approvals, salary components, recruitment stages, templates, branding, custom fields, and holidays are **data**, not code branches.

## 18. Directory & naming conventions

- Packages are published as internal source (`exports` → `./src/index.ts`); apps bundle them. No build step for libs.
- Files: `kebab-case.ts`. Types/classes: `PascalCase`. Vars/functions: `camelCase`. DB tables/columns: `snake_case`, tables plural.
- One bounded context per schema folder in `@hrms/database`.

## 19. Commands

```bash
pnpm install
pnpm dev              # all apps
pnpm typecheck        # strict TS across the repo
pnpm lint             # type-aware ESLint
pnpm test             # unit tests
pnpm test:integration # DB/API/tenant-isolation tests
pnpm db:generate      # drizzle-kit: SQL from schema
pnpm db:migrate       # apply migrations
pnpm seed             # demo tenants (Alpha, Beta) — isolated
```

## 20. When a product decision is unspecified

Choose a sensible production-grade default, record it in `docs/ASSUMPTIONS.md`, and continue. Only stop for input when an external credential or a genuinely irreversible business decision blocks progress.
