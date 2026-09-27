# Modules & Bounded Contexts

Each module maps to a bounded context and (eventually) a `packages/*` domain module + API area + UI.
Status values: **Not Started · Foundation · In Progress · Functional · Production Ready**. Live status
is tracked in `IMPLEMENTATION_STATUS.md` — this file describes scope/ownership.

| Module | Context | Key entities | Entitlement feature |
|---|---|---|---|
| Platform Admin | Platform | platform_admins, plans, features, plan_entitlements | (platform) |
| Subscriptions & Entitlements | Platform/Tenant | subscriptions, tenant_entitlement_overrides | (core) |
| Billing | Billing | invoices, payments (provider-abstracted) | (core) |
| Identity & Auth | Identity | users, sessions, credentials, mfa, invitations | (core) |
| Tenants & Companies | Tenant/Org | tenants, companies, memberships, company_access | core_hr |
| RBAC | RBAC | roles, permissions, role_permissions, member_roles | custom_roles* |
| Organization | Organization | business_units, departments, locations, cost_centres, designations, grades | core_hr |
| Employees (Core HR) | Employee | employees, employment_records, addresses, contacts, bank, gov_ids | core_hr |
| Custom Fields | Employee/Config | custom_field_definitions, custom_field_values | core_hr |
| Employee Lifecycle | Employee | lifecycle_events | core_hr |
| Onboarding | Employee | onboarding_templates, onboarding_tasks | core_hr |
| Documents | Documents | files, document_templates, generated_documents, policies | core_hr |
| Attendance | Attendance | attendance_events, attendance_days, regularizations, policies | attendance |
| Geofencing | Attendance | geofences, locations | geofencing |
| Shifts & Rosters | Attendance | shifts, shift_assignments, rosters | attendance |
| Leave | Leave | leave_types, leave_policies, leave_ledger, leave_requests | leave |
| Holidays | Leave | holiday_calendars, holidays | leave |
| Timesheets | Timesheets | clients, projects, tasks, time_entries, timesheets | timesheets |
| Recruitment / ATS | Recruitment | requisitions, postings, candidates, applications, interviews, offers | recruitment |
| Careers Portal | Recruitment | postings (public), applications | recruitment |
| Payroll | Payroll | pay_groups, salary_structures/components, compensation, runs, payslips | payroll |
| Taxation & Country Packs | Payroll | tax_declarations, country_rule_versions | payroll |
| Loans & Advances | Payroll | loans, loan_installments | payroll |
| Expenses & Reimbursement | Payroll/Ops | expense_claims, categories | expenses |
| Performance | Performance | review_cycles, goals, reviews | performance |
| Assets | Operations | assets, asset_assignments | assets |
| Offboarding | Employee | offboarding_templates, exit_tasks, final_settlement | core_hr |
| Announcements | Notifications | announcements, acknowledgements | core_hr |
| Employee Helpdesk | Operations | tickets, categories | core_hr |
| Approvals Engine | Approvals | approval_workflows, approval_instances | (core) |
| Notifications | Notifications | notifications, preferences, templates | (core) |
| Reporting & Dashboards | (cross) | report definitions, async exports | advanced_reports* |
| Search | (cross) | authorized global search | (core) |
| Audit | Audit | audit_events | (core) |
| Import/Export | (cross) | import_jobs, export_jobs | (core) |
| Integrations | Integrations | integration_configs | api_access |
| API Keys | Integrations | api_keys (hashed, scoped) | api_access |
| Webhooks | Integrations | webhook_endpoints, deliveries | api_access |
| SSO / SCIM | Identity | user_identities, scim_tokens | sso |
| Feature Flags (eng) | Platform | feature_flags, flag_targeting | (core) |

\* Base capability is core; advanced variants (custom roles, advanced reports) gate on their feature.
