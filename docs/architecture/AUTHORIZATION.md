# Authorization (RBAC + Permission Capabilities + Data Scopes)

Authorization answers three independent questions on every protected operation:

1. **Can this user perform this capability at all?** → permission check.
2. **On which rows?** → data-scope check.
3. **Is this feature included in the tenant's subscription?** → entitlement check (see
   `@hrms/entitlements`; distinct from authorization but enforced alongside it).

All three are enforced **server-side**. UI gating is cosmetic.

## Permissions (capabilities)

Fine-grained, dot-namespaced capability strings — never `role === 'admin'`:

```
employee.read              employee.create            employee.update
employee.compensation.read employee.compensation.update
employee.bank.read         employee.gov_id.read
attendance.read            attendance.manage          attendance.regularize.approve
leave.read                 leave.apply                leave.approve
payroll.read               payroll.process            payroll.approve            payroll.lock
recruitment.read           recruitment.manage         offer.approve
documents.read             documents.manage           template.manage
timesheet.read             timesheet.approve
report.view                report.export
settings.manage            role.manage                user.invite
billing.manage             platform.tenant.manage     ... (see @hrms/permissions catalog)
```

Sensitive PII has its **own** permissions (`employee.compensation.read`, `employee.bank.read`,
`employee.gov_id.read`). Having `employee.read` does **not** grant compensation/bank/gov-id.

## Roles

Roles are **named bundles of permissions**, scoped to a tenant. System roles are seeded and
non-deletable; tenants may create **custom roles** by composing permissions.

Seeded roles: `platform_super_admin` (platform), `tenant_owner`, `company_admin`, `hr_admin`,
`payroll_admin`, `recruiter`, `manager`, `department_head`, `finance`, `employee`, `auditor`.

`role_permissions` maps roles→permissions; `member_roles` assigns roles to a `tenant_membership`
(optionally scoped to specific companies). A user's effective permissions = union over their roles in
the active tenant.

## Data scopes

A permission grant carries a **scope** describing which rows it applies to:

```
self               only the acting user's own employee record
direct_reports     employees who report directly to the acting manager
indirect_reports   the manager's full reporting subtree
department         employees in the acting user's department(s)
business_unit      employees in the business unit
location           employees at the location(s)
company            employees within specific company(ies)
tenant             all employees in the tenant
```

Example: a **Manager** has `attendance.read@direct_reports` and `leave.approve@direct_reports` but
**not** `employee.compensation.read` at any scope — a manager cannot see reports' salaries by default.

Scope resolution turns a scope into a SQL predicate (e.g. `direct_reports` → `manager_id = :employeeId`;
`indirect_reports` → a recursive CTE over the reporting tree) which the repository ANDs with the
tenant filter.

## The check API (`@hrms/permissions`)

```ts
// Boolean capability check
authz.can(ctx, 'employee.compensation.read');

// Scope-aware: does ctx have this permission for THIS target employee?
await authz.canAccessEmployee(ctx, 'employee.update', targetEmployeeId); // resolves scope

// Guard (throws Forbidden domain error if not permitted) — used in services
authz.require(ctx, 'payroll.approve');

// Turn a scope into a repository predicate
const predicate = await authz.scopePredicate(ctx, 'attendance.read'); // → { managerId } / { departmentId } / {}
```

Rules:
- Every mutation calls `authz.require(...)`. Every sensitive read calls a scope-aware check.
- No inline/ad-hoc permission logic in handlers — always via `@hrms/permissions`.
- Field-level masking: responses strip PII the caller lacks permission to read (compensation, bank,
  gov id) rather than 403-ing the whole record, so a manager sees a report's profile minus salary.

## Field-level permissions & masking

Sensitive employee field groups: `compensation`, `bank`, `gov_id`, `medical`. Serialization runs
through a field-permission filter driven by the caller's permissions + scope. Masked fields are
omitted or partially masked (e.g. bank `****1234`), never sent then hidden client-side.

## Platform vs tenant authorization

Platform Admin capabilities (`platform.*`) belong to `platform_admins`, evaluated on the Platform
Admin API only. A tenant role can never grant a `platform.*` capability.

## Testing

- Unit tests: permission catalog integrity, role→permission mappings, scope→predicate resolution.
- Integration tests: manager can read direct reports' attendance but not compensation; auditor is
  read-only; cross-tenant attempts fail. Part of the mandatory isolation suite.
