/**
 * Platform context — global, **no `tenant_id`**. This is the SaaS control
 * plane: who runs the product, what plans exist, and what each plan includes.
 *
 * Depends on `identity` only.
 */

import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps } from './_shared';
import { users } from './identity';
import {
  BILLING_INTERVALS,
  FEATURE_KINDS,
  PLAN_STATUSES,
  PLATFORM_ADMIN_ROLES,
  PLATFORM_ADMIN_STATUSES,
  type BillingInterval,
  type FeatureKind,
  type PlanStatus,
  type PlatformAdminRole,
  type PlatformAdminStatus,
} from './enums';

export const platformAdmins = pgTable(
  'platform_admins',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    role: text('role').$type<PlatformAdminRole>().notNull(),
    status: text('status').$type<PlatformAdminStatus>().notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    inList('platform_admins_role_chk', t.role, PLATFORM_ADMIN_ROLES),
    inList('platform_admins_status_chk', t.status, PLATFORM_ADMIN_STATUSES),
  ],
);

export const plans = pgTable(
  'plans',
  {
    id: primaryId(),
    /** Stable machine key: `starter` | `growth` | `professional` | `enterprise`. */
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    billingInterval: text('billing_interval').$type<BillingInterval>().notNull().default('monthly'),
    /** Price in minor units (never floating point). Billing/PSP realm, informational here. */
    priceMinor: bigint('price_minor', { mode: 'bigint' }),
    currency: text('currency'),
    isPublic: boolean('is_public').notNull().default(true),
    status: text('status').$type<PlanStatus>().notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    inList('plans_status_chk', t.status, PLAN_STATUSES),
    inList('plans_billing_interval_chk', t.billingInterval, BILLING_INTERVALS),
  ],
);

export const features = pgTable(
  'features',
  {
    id: primaryId(),
    /**
     * Capability key from the catalog in `@hrms/permissions` / `@hrms/entitlements`:
     * `core_hr`, `attendance`, `geofencing`, `leave`, `timesheets`, `payroll`,
     * `recruitment`, `performance`, `expenses`, `assets`, `advanced_reports`,
     * `api_access`, `sso`, `custom_roles`, `custom_workflows`, …
     */
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').$type<FeatureKind>().notNull(),
    /** For `kind = 'limit'`: what the number counts, e.g. `employees`, `gb`, `api_calls`. */
    unit: text('unit'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [inList('features_kind_chk', t.kind, FEATURE_KINDS)],
);

export const planEntitlements = pgTable(
  'plan_entitlements',
  {
    id: primaryId(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    /** `false` explicitly excludes a feature a parent plan would otherwise grant. */
    enabled: boolean('enabled').notNull().default(true),
    /** `null` for boolean features; an integer ceiling for limit features. */
    limitValue: bigint('limit_value', { mode: 'bigint' }),
    ...timestamps(),
  },
  (t) => [
    unique('plan_entitlements_plan_feature_unique').on(t.planId, t.featureId),
    index('plan_entitlements_plan_idx').on(t.planId),
  ],
);
