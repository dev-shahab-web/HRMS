/**
 * RBAC context — permission **capabilities** and **data scopes**, never
 * `role === 'admin'` (CLAUDE.md §4).
 *
 * `permissions` is a global catalog seeded from `@hrms/permissions`. `roles`
 * may be global templates (`tenant_id IS NULL`, `is_system = true`) or
 * tenant-owned custom roles. A membership is granted roles through
 * `member_roles`, optionally pinned to a single company.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps } from './_shared';
import { tenants, tenantMemberships } from './tenant';
import { PERMISSION_SCOPES, type PermissionScope } from './enums';

export const roles = pgTable(
  'roles',
  {
    id: primaryId(),
    /** `null` = global system template, cloned into tenants as needed. */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    /** Stable key, e.g. `hr_admin`, `manager`, `employee`, or a custom slug. */
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    /** Lower rank = broader authority. Used for escalation checks. */
    rank: text('rank'),
    ...timestamps(),
  },
  (t) => [
    // System roles are globally unique by key; tenant roles are unique per tenant.
    uniqueIndex('roles_global_key_unique')
      .on(t.key)
      .where(sql`${t.tenantId} IS NULL`),
    uniqueIndex('roles_tenant_key_unique')
      .on(t.tenantId, t.key)
      .where(sql`${t.tenantId} IS NOT NULL`),
    index('roles_tenant_idx').on(t.tenantId),
  ],
);

/**
 * Global capability catalog. Keys follow `resource.action` (e.g.
 * `employee.compensation.read`, `payroll.approve`). Seeded from
 * `@hrms/permissions`; never hand-edited in production.
 */
export const permissions = pgTable(
  'permissions',
  {
    id: primaryId(),
    key: text('key').notNull().unique(),
    description: text('description'),
    /** Grouping for the role-builder UI, e.g. `Employee`, `Payroll`. */
    category: text('category').notNull(),
    /** Capabilities that expose PII / compensation get extra audit scrutiny. */
    isSensitive: boolean('is_sensitive').notNull().default(false),
    ...timestamps(),
  },
  (t) => [index('permissions_category_idx').on(t.category)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: primaryId(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    /** Constrains *which rows* the permission applies to (CLAUDE.md §4). */
    scope: text('scope').$type<PermissionScope>().notNull().default('self'),
    ...timestamps(),
  },
  (t) => [
    unique('role_permissions_role_permission_unique').on(t.roleId, t.permissionId),
    inList('role_permissions_scope_chk', t.scope, PERMISSION_SCOPES),
    index('role_permissions_role_idx').on(t.roleId),
  ],
);

export const memberRoles = pgTable(
  'member_roles',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    /** `null` = the role applies tenant-wide; otherwise limited to one company. */
    companyId: uuid('company_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('member_roles_scoped_unique')
      .on(t.membershipId, t.roleId, t.companyId)
      .where(sql`${t.companyId} IS NOT NULL`),
    uniqueIndex('member_roles_tenant_wide_unique')
      .on(t.membershipId, t.roleId)
      .where(sql`${t.companyId} IS NULL`),
    index('member_roles_tenant_idx').on(t.tenantId),
  ],
);
