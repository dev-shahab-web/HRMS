/**
 * Organization context — the tenant's **structure**: legal entities and the
 * reference data hanging off them (departments, locations, cost centres,
 * designations, grades, employment types, teams).
 *
 * Ordering note: `companies` is defined first here, but `business_units` and
 * `departments` reference each other (a department has a business unit; a
 * business unit has a parent). Self- and mutual references use lazy
 * `(): AnyPgColumn =>` thunks so table objects can be created in any order.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps } from './_shared';
import { tenants } from './tenant';
import { COMPANY_STATUSES, type CompanyStatus } from './enums';

export const companies = pgTable(
  'companies',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    tradeName: text('trade_name'),
    /** Human-facing code, unique per tenant. Never a primary key (CLAUDE.md §7). */
    code: text('code').notNull(),
    /** ISO-3166-1 alpha-2. */
    country: text('country').notNull(),
    regionState: text('region_state'),
    /** IANA zone for this entity's business-day math. */
    timezone: text('timezone').notNull(),
    /** ISO-4217 currency for this entity's payroll. */
    currency: text('currency').notNull(),
    /** Free-form statutory registration numbers (per country). */
    registration: jsonb('registration').$type<Record<string, unknown>>(),
    /** Tax identifiers by jurisdiction, e.g. `{ in: { gstin, pan, tan }, ae: { trn } }`. */
    taxIds: jsonb('tax_ids').$type<Record<string, unknown>>(),
    address: jsonb('address').$type<Record<string, unknown>>(),
    /** Encrypted at the app layer. Never logged or audited (CLAUDE.md §9). */
    bankDetailsEncrypted: text('bank_details_encrypted'),
    // FK → files.id enforced at the app layer (breaks the companies↔files cycle).
    logoFileId: uuid('logo_file_id'),
    status: text('status').$type<CompanyStatus>().notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    unique('companies_tenant_code_unique').on(t.tenantId, t.code),
    inList('companies_status_chk', t.status, COMPANY_STATUSES),
    check('companies_country_chk', sql`${t.country} ~ '^[A-Z]{2}$'`),
    check('companies_currency_chk', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    index('companies_tenant_idx').on(t.tenantId),
  ],
);

export const businessUnits = pgTable(
  'business_units',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => businessUnits.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (t) => [
    unique('business_units_tenant_company_code_unique').on(t.tenantId, t.companyId, t.code),
    index('business_units_tenant_idx').on(t.tenantId),
    index('business_units_parent_idx').on(t.parentId),
  ],
);

export const departments = pgTable(
  'departments',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    businessUnitId: uuid('business_unit_id').references(() => businessUnits.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    /** Sub-departments: a tree, not a free-text field. */
    parentId: uuid('parent_id').references((): AnyPgColumn => departments.id, {
      onDelete: 'set null',
    }),
    // FK → employees.id enforced at the app layer (breaks the organization↔employee cycle).
    headEmployeeId: uuid('head_employee_id'),
    ...timestamps(),
  },
  (t) => [
    unique('departments_tenant_company_code_unique').on(t.tenantId, t.companyId, t.code),
    index('departments_tenant_idx').on(t.tenantId),
    index('departments_parent_idx').on(t.parentId),
    index('departments_business_unit_idx').on(t.businessUnitId),
  ],
);

export const locations = pgTable(
  'locations',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: jsonb('address').$type<Record<string, unknown>>(),
    /** The zone attendance for this site is computed in — not the tenant's. */
    timezone: text('timezone').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    /** Geofence radius in metres; `null` = no geofence configured. */
    geofenceRadiusM: integer('geofence_radius_m'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('locations_tenant_company_code_unique').on(t.tenantId, t.companyId, t.code),
    check(
      'locations_lat_chk',
      sql`${t.latitude} IS NULL OR ${t.latitude} BETWEEN -90 AND 90`,
    ),
    check(
      'locations_lng_chk',
      sql`${t.longitude} IS NULL OR ${t.longitude} BETWEEN -180 AND 180`,
    ),
    check(
      'locations_geofence_chk',
      sql`(${t.geofenceRadiusM} IS NULL AND ${t.latitude} IS NULL AND ${t.longitude} IS NULL)
          OR (${t.geofenceRadiusM} IS NOT NULL AND ${t.latitude} IS NOT NULL
              AND ${t.longitude} IS NOT NULL AND ${t.geofenceRadiusM} > 0)`,
    ),
    index('locations_tenant_idx').on(t.tenantId),
  ],
);

export const costCentres = pgTable(
  'cost_centres',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('cost_centres_tenant_company_code_unique').on(t.tenantId, t.companyId, t.code),
    index('cost_centres_tenant_idx').on(t.tenantId),
  ],
);

export const designations = pgTable(
  'designations',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** `null` = available to every company in the tenant. */
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    ...timestamps(),
  },
  (t) => [
    unique('designations_tenant_code_unique').on(t.tenantId, t.code),
    index('designations_tenant_idx').on(t.tenantId),
  ],
);

/** Job levels / grades. `rank` orders them (1 = most junior or most senior — set by policy). */
export const jobLevels = pgTable(
  'job_levels',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    rank: integer('rank').notNull().default(0),
    ...timestamps(),
  },
  (t) => [unique('job_levels_tenant_code_unique').on(t.tenantId, t.code)],
);

/** Employment types. `permanent` … `consultant` are seeded defaults, not a closed set. */
export const employmentTypes = pgTable(
  'employment_types',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    /** Seeded system types cannot be deleted by a tenant admin. */
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [unique('employment_types_tenant_code_unique').on(t.tenantId, t.code)],
);

export const teams = pgTable(
  'teams',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code'),
    // FK → employees.id enforced at the app layer (organization↔employee cycle).
    leadEmployeeId: uuid('lead_employee_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('teams_tenant_company_code_unique')
      .on(t.tenantId, t.companyId, t.code)
      .where(sql`${t.code} IS NOT NULL`),
    index('teams_tenant_idx').on(t.tenantId),
    index('teams_department_idx').on(t.departmentId),
  ],
);
