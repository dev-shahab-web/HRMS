# Data Model (ERD) — by Bounded Context

UUIDv7 primary keys (`id`) everywhere. Tenant-scoped tables carry `tenant_id` (and `company_id` where
applicable). Common columns: `created_at`, `updated_at` (`timestamptz`), and `version int` on
concurrency-sensitive tables. `snake_case` tables (plural) and columns.

Legend: **PK** primary key · **FK** foreign key · **U** unique · **U(tenant,…)** tenant-scoped unique.

> This document is the source of truth for the schema in `@hrms/database`. The **Foundation** contexts
> below are implemented now; later contexts are specified here and implemented in their phase.

---

## Context: Platform (global, no tenant_id)

Runs the SaaS itself.

- **platform_admins** — SaaS staff identity. `id`, `user_id` FK→users **U**, `role`
  (`super_admin`|`support`|`billing`|`read_only`), `status`, timestamps.
- **plans** — subscription plans. `id`, `code` **U** (`starter`|`growth`|`professional`|`enterprise`),
  `name`, `description`, `billing_interval` default, `is_public`, `status`, timestamps.
- **features** — catalog of toggleable/limited capabilities. `id`, `key` **U**
  (`core_hr`,`attendance`,`geofencing`,`leave`,`timesheets`,`payroll`,`recruitment`,`performance`,
  `expenses`,`assets`,`advanced_reports`,`api_access`,`sso`,`custom_roles`,`custom_workflows`,…),
  `name`, `kind` (`boolean`|`limit`), `unit` (nullable, e.g. `employees`,`gb`), timestamps.
- **plan_entitlements** — what a plan includes. `id`, `plan_id` FK, `feature_id` FK, `enabled bool`,
  `limit_value bigint null`, U(plan_id, feature_id).

## Context: Identity (global)

Login identity, **separate from employment**.

- **users** — `id`, `email` **U (citext/lower)**, `email_verified_at`, `status`
  (`active`|`invited`|`disabled`), `full_name`, `preferred_name`, `avatar_file_id` FK→files null,
  `locale`, `timezone`, `last_login_at`, timestamps.
- **user_credentials** — `id`, `user_id` FK **U**, `password_hash` (versioned string), `password_set_at`,
  `must_change bool`. (Nullable relationship — SSO-only users have no password.)
- **user_identities** — external IdP links (OIDC/SAML). `id`, `user_id` FK, `provider`,
  `provider_subject`, `metadata jsonb`, U(provider, provider_subject).
- **mfa_factors** — `id`, `user_id` FK, `type` (`totp`|`webauthn`), `secret_encrypted`, `confirmed_at`,
  `label`, timestamps.
- **sessions** — `id`, `user_id` FK, `active_tenant_id` FK→tenants null, `token_hash` **U**,
  `created_at`, `last_seen_at`, `expires_at`, `absolute_expires_at`, `ip`, `user_agent`,
  `revoked_at`, `mfa_satisfied bool`.
- **login_audit** — `id`, `user_id` null, `email_attempted`, `result`
  (`success`|`bad_password`|`locked`|`mfa_required`|`mfa_failed`), `ip`, `user_agent`, `created_at`.
- **invitations** — `id`, `tenant_id` FK, `email`, `role_ids uuid[]`, `company_ids uuid[]`,
  `invited_by` FK→users, `token_hash` **U**, `status` (`pending`|`accepted`|`revoked`|`expired`),
  `expires_at`, `accepted_at`, U(tenant_id, email) where pending.

## Context: Tenant (tenant root)

- **tenants** — customer account. `id`, `name`, `slug` **U**, `status`
  (`trial`|`active`|`suspended`|`cancelled`), `primary_timezone`, `default_currency`,
  `default_locale`, `financial_year_start_month`, `week_start_day`, `date_format`, `time_format`,
  `logo_file_id` FK null, `branding jsonb`, timestamps.
- **subscriptions** — `id`, `tenant_id` FK, `plan_id` FK, `status`
  (`trialing`|`active`|`past_due`|`paused`|`cancelled`), `billing_interval`, `seats int null`,
  `trial_ends_at`, `current_period_start/end`, `cancel_at`, `provider`, `provider_ref`, timestamps.
- **tenant_entitlement_overrides** — per-tenant overrides/add-ons/trials. `id`, `tenant_id` FK,
  `feature_id` FK, `enabled bool null`, `limit_value bigint null`, `reason`, `effective_from`,
  `effective_to null`, `created_by`, timestamps. U(tenant_id, feature_id, effective_from).
- **tenant_memberships** — a user's access to a tenant. `id`, `tenant_id` FK, `user_id` FK,
  `status` (`active`|`invited`|`suspended`), `is_owner bool`, `created_at`, U(tenant_id, user_id).
- **company_access** — which companies within the tenant a membership can access. `id`, `tenant_id`,
  `membership_id` FK, `company_id` FK, U(membership_id, company_id). (Empty set = all companies if role allows.)

## Context: RBAC (tenant-scoped; system roles are tenant-cloned or global-flagged)

- **roles** — `id`, `tenant_id` null(=system template)/FK, `key`, `name`, `description`,
  `is_system bool`, U(tenant_id, key).
- **permissions** — global capability catalog (seeded from `@hrms/permissions`). `id`, `key` **U**,
  `description`, `category`.
- **role_permissions** — `role_id` FK, `permission_id` FK, `scope`
  (`self`|`direct_reports`|`indirect_reports`|`department`|`business_unit`|`location`|`company`|`tenant`),
  U(role_id, permission_id).
- **member_roles** — `id`, `tenant_id`, `membership_id` FK, `role_id` FK, `company_id` FK null
  (role limited to a company), U(membership_id, role_id, company_id).

## Context: Organization (tenant + company scoped)

- **companies** — legal entity. `id`, `tenant_id` FK, `legal_name`, `trade_name`, `code` **U(tenant)**,
  `country`, `region_state`, `timezone`, `currency`, `registration jsonb`, `tax_ids jsonb`,
  `address jsonb`, `bank_details_encrypted`, `logo_file_id` null, `status`, timestamps.
- **business_units** — `id`, `tenant_id`, `company_id` FK, `name`, `code`, `parent_id` FK null,
  U(tenant_id, company_id, code).
- **departments** — `id`, `tenant_id`, `company_id` FK, `business_unit_id` FK null, `name`, `code`,
  `parent_id` FK null (sub-departments), `head_employee_id` FK null, U(tenant_id, company_id, code).
- **locations** — work location + geofence. `id`, `tenant_id`, `company_id` FK, `name`, `code`,
  `address jsonb`, `timezone`, `latitude numeric(9,6) null`, `longitude numeric(9,6) null`,
  `geofence_radius_m int null`, `is_active`, U(tenant_id, company_id, code).
- **cost_centres** — `id`, `tenant_id`, `company_id` FK, `name`, `code`, `is_active`,
  U(tenant_id, company_id, code).
- **designations** — job titles. `id`, `tenant_id`, `company_id` FK null, `name`, `code`,
  U(tenant_id, code).
- **job_levels / grades** — `id`, `tenant_id`, `name`, `code`, `rank int`, U(tenant_id, code).
- **employment_types** — `id`, `tenant_id`, `name` (`permanent`|`contract`|`intern`|`consultant`|
  `temporary`|custom), `code`, `is_system`, U(tenant_id, code).
- **teams** — `id`, `tenant_id`, `company_id`, `department_id` FK null, `name`, `lead_employee_id` null.

## Context: Employee (tenant + company scoped) — Foundation core

- **employees** — the person's employment root. `id`, `tenant_id`, `company_id` FK, `user_id` FK→users
  null (self-service login link), `employee_code` **U(tenant, company)**, `first_name`, `last_name`,
  `preferred_name`, `personal_email`, `work_email`, `work_phone`, `dob date null`, `gender null`,
  `status` (`preboarding`|`active`|`on_leave`|`suspended`|`exited`), `date_of_joining`,
  `probation_end_date null`, `confirmation_date null`, `exit_date null`, `profile_photo_file_id null`,
  `version int`, timestamps. Composite index (tenant_id, company_id, status).
- **employment_records** — effective-dated employment history (never overwrite). `id`, `tenant_id`,
  `employee_id` FK, `effective_from date`, `effective_to date null`, `department_id`, `designation_id`,
  `grade_id null`, `location_id`, `cost_centre_id null`, `employment_type_id`, `manager_id` FK→employees
  null, `dotted_line_manager_id null`, `hr_partner_id null`, `work_mode` (`onsite`|`remote`|`hybrid`),
  `change_reason`, `created_by`, timestamps. Index (tenant_id, employee_id, effective_from).
- **employee_addresses / employee_contacts / emergency_contacts / dependents** — child detail tables,
  each `tenant_id` + `employee_id` scoped.
- **employee_bank_accounts** — `id`, `tenant_id`, `employee_id`, `account_encrypted`, `ifsc_swift_masked`,
  `bank_name`, `is_primary`. (Encrypted at app level; only last 4 shown.)
- **employee_gov_ids** — country-specific statutory IDs. `id`, `tenant_id`, `employee_id`,
  `country`, `type`, `value_encrypted`, `value_masked`. (No India-only columns; type is data.)
- **employee_documents / employee_assets / employee_education / employee_experience / skills /
  certifications** — child tables, tenant + employee scoped (built in later phases).

## Context: Custom Fields (configurability, tenant-scoped) — metadata/value, no dynamic DDL

- **custom_field_definitions** — `id`, `tenant_id`, `entity` (`employee`|`candidate`|`job`|`asset`|…),
  `key`, `label`, `type` (`text`|`long_text`|`number`|`currency`|`date`|`datetime`|`boolean`|`select`|
  `multi_select`|`user`|`department`|`location`|`url`|`email`|`phone`), `config jsonb` (options,
  validation, default), `required bool`, `visibility jsonb`, `order int`, U(tenant_id, entity, key).
- **custom_field_values** — `id`, `tenant_id`, `definition_id` FK, `entity`, `entity_id`,
  `value jsonb`, U(definition_id, entity_id). No columns are ever created at runtime.

## Context: Audit (append-only)

- **audit_events** — immutable. `id`, `tenant_id` null(platform), `company_id null`, `actor_user_id null`,
  `actor_label`, `action` (e.g. `employee.updated`), `entity_type`, `entity_id`, `before jsonb null`,
  `after jsonb null`, `request_id`, `correlation_id`, `ip null`, `source`
  (`web`|`mobile`|`api`|`system`|`platform_admin`), `created_at`. Indexed (tenant_id, created_at),
  (entity_type, entity_id). No updates/deletes (enforced by app + role privileges).

## Context: Files (tenant-scoped metadata over R2)

- **files** — `id`, `tenant_id`, `company_id null`, `owner_entity`, `owner_entity_id`, `r2_key` **U**,
  `original_filename`, `mime_type`, `size_bytes bigint`, `checksum_sha256`, `document_type`,
  `document_category`, `uploaded_by`, `expires_at null`, `version int`, `status`
  (`pending`|`clean`|`quarantined`|`deleted`), `retention_policy`, `metadata jsonb`, timestamps.

---

## Later contexts (specified in their phase docs)

- **Attendance:** `shifts`, `shift_assignments`, `rosters`, `attendance_events` (raw, immutable),
  `attendance_days` (derived), `attendance_regularizations`, `attendance_policies`, `geofences`.
- **Leave:** `leave_types`, `leave_policies`, `leave_ledger` (append-only balance entries),
  `leave_requests`, `holiday_calendars`, `holidays`.
- **Timesheets:** `clients`, `projects`, `tasks`, `time_entries`, `timesheets`.
- **Recruitment:** `job_requisitions`, `job_postings`, `candidates`, `applications`, `pipeline_stages`,
  `interviews`, `scorecards`, `offers`.
- **Documents:** `document_templates`, `generated_documents`, `policies`, `policy_acknowledgements`.
- **Payroll:** `pay_groups`, `payroll_calendars`, `payroll_periods`, `salary_components`,
  `salary_structures`, `employee_compensation` (effective-dated, immutable), `payroll_runs`,
  `payroll_run_lines`, `payslips`, `tax_declarations`, `loans`, `payroll_country_rule_versions`.
- **Approvals:** `approval_workflows`, `approval_workflow_steps`, `approval_instances`,
  `approval_actions` (workflow snapshot stored on instance).
- **Notifications / Billing / Integrations / Webhooks:** per their phases.

All later tenant-scoped tables follow the same rules: `tenant_id`, tenant-scoped uniqueness, RLS,
tenant-scoped repositories, and a cross-tenant test.
