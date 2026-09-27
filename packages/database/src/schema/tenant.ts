/**
 * Tenant context — the **tenant root**. A tenant is the customer account that
 * owns all tenant-scoped data. A tenant is NOT a company: one tenant may
 * contain many legal entities (`companies`, in the organization context).
 *
 * Depends on `identity` (for `invited_by` / `created_by` actor references) and
 * on `platform` (plans). `logo_file_id` is a plain `uuid` (files-module
 * integrity is app-enforced) so this module does not depend on `files`.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { dateOnly, inList, primaryId, timestamps, tzTimestamp } from './_shared';
import { users } from './identity';
import { features, plans } from './platform';
import {
  BILLING_INTERVALS,
  MEMBERSHIP_STATUSES,
  SUBSCRIPTION_STATUSES,
  TENANT_STATUSES,
  type BillingInterval,
  type MembershipStatus,
  type SubscriptionStatus,
  type TenantStatus,
} from './enums';

/** ISO-4217 shape check. The authoritative code list lives in `@hrms/domain`. */
const ISO_CURRENCY_PATTERN = '^[A-Z]{3}$';

export const tenants = pgTable(
  'tenants',
  {
    id: primaryId(),
    name: text('name').notNull(),
    /** URL-safe unique handle, e.g. `acme-corp`. */
    slug: text('slug').notNull().unique(),
    status: text('status').$type<TenantStatus>().notNull().default('trial'),
    /** IANA zone, e.g. `Asia/Kolkata`. Never assume server tz (CLAUDE.md §6). */
    primaryTimezone: text('primary_timezone').notNull().default('UTC'),
    /** ISO-4217. Money is integer minor units in this currency. */
    defaultCurrency: text('default_currency').notNull().default('USD'),
    defaultLocale: text('default_locale').notNull().default('en'),
    /** 1–12. Fiscal year starting month (e.g. 4 for India, 1 for UAE/US). */
    financialYearStartMonth: integer('financial_year_start_month').notNull().default(1),
    /** 0 = Sunday … 6 = Saturday. */
    weekStartDay: integer('week_start_day').notNull().default(1),
    dateFormat: text('date_format').notNull().default('DD/MM/YYYY'),
    timeFormat: text('time_format').notNull().default('24h'),
    // FK → files.id enforced at the app layer (breaks the tenants↔files module cycle).
    logoFileId: uuid('logo_file_id'),
    branding: jsonb('branding').$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => [
    inList('tenants_status_chk', t.status, TENANT_STATUSES),
    check('tenants_currency_chk', sql`${t.defaultCurrency} ~ ${sql.raw(`'${ISO_CURRENCY_PATTERN}'`)}`),
    check(
      'tenants_fy_start_month_chk',
      sql`${t.financialYearStartMonth} BETWEEN 1 AND 12`,
    ),
    check('tenants_week_start_day_chk', sql`${t.weekStartDay} BETWEEN 0 AND 6`),
    inList('tenants_date_format_chk', t.dateFormat, ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
    inList('tenants_time_format_chk', t.timeFormat, ['12h', '24h']),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: text('status').$type<SubscriptionStatus>().notNull().default('trialing'),
    billingInterval: text('billing_interval').$type<BillingInterval>().notNull().default('monthly'),
    /** Purchased seat count; `null` = unlimited / metered elsewhere. */
    seats: integer('seats'),
    trialEndsAt: tzTimestamp('trial_ends_at'),
    currentPeriodStart: tzTimestamp('current_period_start'),
    currentPeriodEnd: tzTimestamp('current_period_end'),
    cancelAt: tzTimestamp('cancel_at'),
    cancelledAt: tzTimestamp('cancelled_at'),
    /** Billing provider abstraction (CLAUDE.md §12) — no provider calls in the domain. */
    provider: text('provider'),
    providerRef: text('provider_ref'),
    ...timestamps(),
  },
  (t) => [
    inList('subscriptions_status_chk', t.status, SUBSCRIPTION_STATUSES),
    inList('subscriptions_billing_interval_chk', t.billingInterval, BILLING_INTERVALS),
    index('subscriptions_tenant_idx').on(t.tenantId),
    // At most one live subscription per tenant; history is kept as cancelled rows.
    uniqueIndex('subscriptions_tenant_live_unique')
      .on(t.tenantId)
      .where(sql`${t.status} IN ('trialing', 'active', 'past_due', 'paused')`),
  ],
);

/**
 * Per-tenant entitlement overrides: add-ons, trials, contract carve-outs. The
 * effective entitlement is plan ∪ overrides, resolved by `@hrms/entitlements`.
 * Overrides are effective-dated so an audit of "what were they entitled to on
 * date X" is answerable.
 */
export const tenantEntitlementOverrides = pgTable(
  'tenant_entitlement_overrides',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    /** `null` = no opinion, inherited from the plan. */
    enabled: boolean('enabled'),
    /** For limit features; `null` = inherited from the plan. */
    limitValue: bigint('limit_value', { mode: 'bigint' }),
    reason: text('reason'),
    effectiveFrom: dateOnly('effective_from').notNull(),
    /** `null` = open-ended. */
    effectiveTo: dateOnly('effective_to'),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique('tenant_entitlement_overrides_unique').on(t.tenantId, t.featureId, t.effectiveFrom),
    index('tenant_entitlement_overrides_lookup_idx').on(t.tenantId, t.featureId),
  ],
);

/**
 * A user's access to a tenant. This is the join that makes `user` and `tenant`
 * many-to-many: the same person can be an employee of one tenant and an admin
 * of another. Per CLAUDE.md §1, tenant context is resolved from here (server
 * side), never from a client-supplied tenant id.
 */
export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<MembershipStatus>().notNull().default('active'),
    /** The founding/owner membership. Exactly one per tenant (partial unique below). */
    isOwner: boolean('is_owner').notNull().default(false),
    createdAt: tzTimestamp('created_at').notNull().defaultNow(),
    updatedAt: tzTimestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('tenant_memberships_tenant_user_unique').on(t.tenantId, t.userId),
    inList('tenant_memberships_status_chk', t.status, MEMBERSHIP_STATUSES),
    index('tenant_memberships_user_idx').on(t.userId),
    uniqueIndex('tenant_memberships_single_owner_unique')
      .on(t.tenantId)
      .where(sql`${t.isOwner} = true`),
  ],
);

/**
 * Which companies inside a tenant a membership may see. An **empty set** means
 * "no company restriction" — scoping is then governed by the role's data
 * scopes. A non-empty set is an allow-list that constrains company-scoped
 * permissions.
 */
export const companyAccess = pgTable(
  'company_access',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull(),
    createdAt: tzTimestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('company_access_membership_company_unique').on(t.membershipId, t.companyId),
    index('company_access_tenant_idx').on(t.tenantId),
  ],
);
