# Product Requirements (Summary)

> The authoritative, exhaustive requirement is the project **Master Prompt** (the 123-section brief).
> This file distills it into a working reference. Where the master prompt is silent, see
> `docs/ASSUMPTIONS.md`.

## Vision

A modern, premium, **configurable** HRMS SaaS — scope comparable to Keka / Darwinbox / BambooHR /
Zoho People / Rippling — that businesses would pay for. Configure, don't customize source: leave
policies, shifts, approvals, salary components, recruitment stages, document templates, branding,
custom fields, and holidays are all **data**.

## Actors

Platform Super Admin · Tenant Owner · Company Admin · HR Admin · Payroll Admin · Recruiter · Manager ·
Department Head · Finance · Employee · Auditor · Custom roles.

## Surfaces

Web app (HR/Manager/ESS) · Mobile app (employee-centric) · Platform Admin · Careers portal · REST API.

## Functional pillars

1. **SaaS control plane** — tenants, companies, plans, feature entitlements, subscriptions, billing,
   usage limits, impersonation (audited), system health.
2. **Core HR** — org structure, employees, effective-dated employment history, custom fields,
   documents, lifecycle (preboarding→alumni), onboarding.
3. **Time** — attendance (mobile GPS/web/kiosk/import), geofencing, shifts & rosters, attendance
   processing & regularization, leave (ledger-based) & holidays, timesheets/worklogs.
4. **Talent** — recruitment/ATS (requisitions, pipeline, interviews, scorecards, offers, careers site,
   candidate→employee), performance (reviews, goals/OKRs).
5. **Payroll & finance** — compensation (effective-dated), salary structures & components, payroll
   engine + country packs (IN/AE/US), payroll runs, payslips, tax declarations, loans, expenses.
6. **Operations** — assets, offboarding, announcements, employee helpdesk, approvals engine,
   notifications, document/letter generation.
7. **Platform-wide** — RBAC + data scopes, audit, reporting/dashboards, search, imports/exports,
   integrations, webhooks, API keys, feature flags, observability.

## Cross-cutting non-functionals (non-negotiable)

- **Tenant isolation** (defense in depth) · **server-side authZ** · **entitlement enforcement** ·
  **auditability** · **money precision** · **timezone correctness** · **idempotency/concurrency** ·
  **accessibility (WCAG)** · **responsive** · **light/dark** · **i18n-ready** · **observability** ·
  **testability**.

## Explainability requirements

The system must answer: *why did employee X get this pay?*, *why is this day absent?*, *why is this
leave balance 8.5?* — every payroll/attendance/leave outcome carries a calculation breakdown.

## Scale targets

20 (small) · 1,000 (medium) · 50,000+ (large) employees per tenant; thousands of tenants. Pagination,
indexing, async jobs from day one; no design choice that fundamentally blocks scaling.
