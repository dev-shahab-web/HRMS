# Implementation Plan (Phased)

Execution is by **production-quality vertical slices**, not stubs. A slice isn't "done" until it meets
the Definition of Done in `CLAUDE.md` §13. Live per-module status: `IMPLEMENTATION_STATUS.md`.

## Phase 0 — Architecture & Foundation  ← current

Monorepo, coding standards, architecture docs, DB foundation + migrations, tenant resolution,
RBAC, entitlement engine, audit foundation, API standards, design system seed, CI, test harness,
Cloudflare config scaffolding.

**Foundation milestone (spec §99) — end-to-end target:**
working monorepo · local dev · DB schema foundation · migrations · seed · authentication ·
tenant creation · company creation · tenant switching · RBAC · entitlement engine · core employee
model · employee list · create/edit employee · Platform Admin tenant list · audit logging · Worker
deploy · R2 integration · basic mobile login · **automated tenant-isolation tests**.

## Phase 1 — SaaS Platform
Platform Admin, tenant/company management, plans, entitlements, subscription foundation, tenant onboarding wizard.

## Phase 2 — Core HR
Org structures, employees, profiles, effective-dated history, documents, custom fields, manager hierarchy.

## Phase 3 — Attendance
Shifts, rosters, locations, geofencing, mobile attendance, attendance calculation engine, regularization.

## Phase 4 — Leave
Leave policies, ledger, applications, approvals, holidays.

## Phase 5 — Timesheets
Clients, projects, tasks, time entries, approvals, reporting.

## Phase 6 — Recruitment
Requisitions, ATS pipeline, interviews, careers site, offers, candidate→employee conversion.

## Phase 7 — Documents & Onboarding
Template engine, PDF rendering, letters, policies + acknowledgements, onboarding workflows.

## Phase 8 — Payroll
Compensation, salary structures/components, payroll engine, periods, processing, validation, payslips,
taxation architecture, first country pack (IN), then AE/US.

## Phase 9 — Employee Operations
Expenses, assets, performance, helpdesk, announcements, offboarding.

## Phase 10 — Enterprise
SSO, SCIM, API keys, webhooks, advanced audit, custom reports, custom workflows, advanced feature flags.

---

## Build order within a slice (applies every phase)

1. ERD entry + schema (`@hrms/database`) with tenant_id, constraints, RLS.
2. Migration (`drizzle-kit generate`) + apply + seed support.
3. Domain types/logic (`@hrms/domain` + module package) with unit tests.
4. Validation schemas (`@hrms/validation`).
5. Tenant-scoped repository + repository tests (incl. cross-tenant).
6. Application/domain services with authZ + entitlement + audit + domain events.
7. API routes (thin) + OpenAPI + typed client.
8. Integration tests (API + tenant boundary).
9. UI (web/mobile) with loading/error/empty states, responsive, a11y.
10. E2E for critical flow. Update `IMPLEMENTATION_STATUS.md` honestly.

## Session log

- **2026-09-24 (session 1):** Phase 0 kickoff. Monorepo tooling, full doc set, `@hrms/domain`
  (ids/Money/errors/events).
- **2026-09-25 (session 3):** Resumed from existing work. Validated and fixed `@hrms/database`
  foundation schema, migration runner path, local migration/seed CLIs, PGlite harness, and RLS
  cross-tenant isolation tests. Tenant-scoped repositories remain the next foundation slice.
