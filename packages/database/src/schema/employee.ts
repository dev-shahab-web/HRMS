/**
 * Employee context — the **foundation core**.
 *
 * Distinctions that must never be conflated (CLAUDE.md §2):
 *   - `employees` is the *employment* root; `users` is the *login identity*.
 *     The link is nullable: a pre-boarding hire exists before they have a login.
 *   - `employment_records` is **effective-dated history** — a transfer inserts a
 *     new row, it never overwrites. "Who was their manager in March?" must stay
 *     answerable.
 *   - Sensitive columns (bank accounts, government ids) are ciphertext plus a
 *     masked display value. Plaintext never reaches the database.
 *
 * `employees` and the organization context reference each other
 * (`employment_records.manager_id → employees`, `departments.head_employee_id →
 * employees`), so cross-context references here break the module cycle with
 * plain `uuid` columns whose integrity the app layer enforces.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { dateOnly, inList, primaryId, timestamps, versionColumn } from './_shared';
import { tenants } from './tenant';
import { companies, costCentres, departments, designations, employmentTypes, jobLevels, locations } from './organization';
import { users } from './identity';
import {
  ADDRESS_TYPES,
  CONTACT_TYPES,
  EMPLOYEE_STATUSES,
  GENDERS,
  RELATIONSHIPS,
  WORK_MODES,
  type AddressType,
  type ContactType,
  type EmployeeStatus,
  type Gender,
  type Relationship,
  type WorkMode,
} from './enums';

export const employees = pgTable(
  'employees',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    /** Self-service login link. `null` until the employee is invited. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Human-facing code. Unique per (tenant, company) — never a PK (CLAUDE.md §7). */
    employeeCode: text('employee_code').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    preferredName: text('preferred_name'),
    personalEmail: text('personal_email'),
    workEmail: text('work_email'),
    workPhone: text('work_phone'),
    dob: dateOnly('dob'),
    gender: text('gender').$type<Gender>(),
    status: text('status').$type<EmployeeStatus>().notNull().default('preboarding'),
    dateOfJoining: dateOnly('date_of_joining').notNull(),
    probationEndDate: dateOnly('probation_end_date'),
    confirmationDate: dateOnly('confirmation_date'),
    exitDate: dateOnly('exit_date'),
    // FK → files.id enforced at the app layer (breaks the employee↔files cycle).
    profilePhotoFileId: uuid('profile_photo_file_id'),
    version: versionColumn(),
    ...timestamps(),
  },
  (t) => [
    unique('employees_tenant_company_code_unique').on(t.tenantId, t.companyId, t.employeeCode),
    inList('employees_status_chk', t.status, EMPLOYEE_STATUSES),
    inList('employees_gender_chk', t.gender, GENDERS),
    index('employees_tenant_company_status_idx').on(t.tenantId, t.companyId, t.status),
    index('employees_tenant_idx').on(t.tenantId),
    // A login maps to at most one employment record per tenant.
    uniqueIndex('employees_tenant_user_unique')
      .on(t.tenantId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    check('employees_exit_date_chk', sql`${t.exitDate} IS NULL OR ${t.exitDate} >= ${t.dateOfJoining}`),
  ],
);

/**
 * Effective-dated employment history. Exactly one open record per employee
 * (partial unique on the null `effective_to`); a change closes the current row
 * and opens a new one in the same transaction.
 */
export const employmentRecords = pgTable(
  'employment_records',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    effectiveFrom: dateOnly('effective_from').notNull(),
    /** `null` = currently in force. */
    effectiveTo: dateOnly('effective_to'),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'restrict' }),
    designationId: uuid('designation_id').references(() => designations.id, {
      onDelete: 'restrict',
    }),
    gradeId: uuid('grade_id').references(() => jobLevels.id, { onDelete: 'set null' }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'restrict' }),
    costCentreId: uuid('cost_centre_id').references(() => costCentres.id, {
      onDelete: 'set null',
    }),
    employmentTypeId: uuid('employment_type_id')
      .notNull()
      .references(() => employmentTypes.id, { onDelete: 'restrict' }),
    /** Self-reference: a manager is an employee. */
    managerId: uuid('manager_id').references((): AnyPgColumn => employees.id, {
      onDelete: 'set null',
    }),
    dottedLineManagerId: uuid('dotted_line_manager_id').references(
      (): AnyPgColumn => employees.id,
      { onDelete: 'set null' },
    ),
    hrPartnerId: uuid('hr_partner_id').references((): AnyPgColumn => employees.id, {
      onDelete: 'set null',
    }),
    workMode: text('work_mode').$type<WorkMode>().notNull().default('onsite'),
    changeReason: text('change_reason'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    inList('employment_records_work_mode_chk', t.workMode, WORK_MODES),
    index('employment_records_tenant_employee_effective_idx').on(
      t.tenantId,
      t.employeeId,
      t.effectiveFrom,
    ),
    // At most one open-ended record per employee.
    uniqueIndex('employment_records_one_current_unique')
      .on(t.employeeId)
      .where(sql`${t.effectiveTo} IS NULL`),
    check(
      'employment_records_range_chk',
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`,
    ),
  ],
);

export const employeeAddresses = pgTable(
  'employee_addresses',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    type: text('type').$type<AddressType>().notNull().default('current'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    /** ISO-3166-1 alpha-2. */
    country: text('country'),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    inList('employee_addresses_type_chk', t.type, ADDRESS_TYPES),
    index('employee_addresses_employee_idx').on(t.employeeId),
    uniqueIndex('employee_addresses_primary_unique')
      .on(t.employeeId, t.type)
      .where(sql`${t.isPrimary} = true`),
  ],
);

export const employeeContacts = pgTable(
  'employee_contacts',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    type: text('type').$type<ContactType>().notNull(),
    value: text('value').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    inList('employee_contacts_type_chk', t.type, CONTACT_TYPES),
    index('employee_contacts_employee_idx').on(t.employeeId),
  ],
);

export const emergencyContacts = pgTable(
  'emergency_contacts',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: text('relationship').$type<Relationship>().notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    inList('emergency_contacts_relationship_chk', t.relationship, RELATIONSHIPS),
    index('emergency_contacts_employee_idx').on(t.employeeId),
  ],
);

export const dependents = pgTable(
  'dependents',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: text('relationship').$type<Relationship>().notNull(),
    dob: dateOnly('dob'),
    gender: text('gender').$type<Gender>(),
    /** Whether the dependent is covered by the employee's insurance plan. */
    isInsured: boolean('is_insured').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    inList('dependents_relationship_chk', t.relationship, RELATIONSHIPS),
    inList('dependents_gender_chk', t.gender, GENDERS),
    index('dependents_employee_idx').on(t.employeeId),
  ],
);

/**
 * Bank accounts. `accountEncrypted` is ciphertext from the app-level KMS; the
 * masked value is the only thing any read path or audit log may expose
 * (CLAUDE.md §9). `ifsc_swift_masked` follows the same rule.
 */
export const employeeBankAccounts = pgTable(
  'employee_bank_accounts',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    accountEncrypted: text('account_encrypted').notNull(),
    /** Display-only, e.g. `•••• 4321`. Never the full number. */
    accountMasked: text('account_masked').notNull(),
    ifscSwiftMasked: text('ifsc_swift_masked'),
    bankName: text('bank_name'),
    branchName: text('branch_name'),
    accountType: text('account_type'),
    isPrimary: boolean('is_primary').notNull().default(false),
    effectiveFrom: dateOnly('effective_from'),
    effectiveTo: dateOnly('effective_to'),
    ...timestamps(),
  },
  (t) => [
    index('employee_bank_accounts_employee_idx').on(t.employeeId),
    // One primary account per employee at a time.
    uniqueIndex('employee_bank_accounts_primary_unique')
      .on(t.employeeId)
      .where(sql`${t.isPrimary} = true AND ${t.effectiveTo} IS NULL`),
  ],
);

/**
 * Country-specific statutory identifiers. There is deliberately **no
 * India-only column**: the jurisdiction lives in `country` and the kind in
 * `type`, so a new country is data, not a migration (CLAUDE.md §17).
 */
export const employeeGovIds = pgTable(
  'employee_gov_ids',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** ISO-3166-1 alpha-2. */
    country: text('country').notNull(),
    /** e.g. `pan`, `aadhaar`, `uan`, `emirates_id`, `ssn`, `nino`. */
    type: text('type').notNull(),
    valueEncrypted: text('value_encrypted').notNull(),
    /** Display-only, e.g. `XXXXXX1234`. */
    valueMasked: text('value_masked').notNull(),
    issuedAt: dateOnly('issued_at'),
    expiresAt: dateOnly('expires_at'),
    ...timestamps(),
  },
  (t) => [
    unique('employee_gov_ids_unique').on(t.tenantId, t.employeeId, t.country, t.type),
    index('employee_gov_ids_employee_idx').on(t.employeeId),
    check('employee_gov_ids_country_chk', sql`${t.country} ~ '^[A-Z]{2}$'`),
  ],
);
