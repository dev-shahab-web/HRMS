/**
 * Closed value sets used across the schema. Stored as `text` columns with a
 * `$type<>()` for compile-time safety and a DB `CHECK` constraint for integrity
 * (see `inList` in `_shared.ts`). We deliberately avoid Postgres `enum` types:
 * `text + CHECK` is portable (PGlite and any Postgres), and evolving the set is
 * an ordinary migration rather than a non-transactional `ALTER TYPE`.
 *
 * Each set is a `const` tuple (for the CHECK SQL and for Zod) plus a derived
 * union type. This is the one place these values are defined.
 */

export const PLATFORM_ADMIN_ROLES = ['super_admin', 'support', 'billing', 'read_only'] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const PLATFORM_ADMIN_STATUSES = ['active', 'disabled'] as const;
export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number];

export const PLAN_STATUSES = ['active', 'deprecated', 'hidden'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const BILLING_INTERVALS = ['monthly', 'quarterly', 'annual'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const FEATURE_KINDS = ['boolean', 'limit'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export const USER_STATUSES = ['active', 'invited', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const MFA_TYPES = ['totp', 'webauthn'] as const;
export type MfaType = (typeof MFA_TYPES)[number];

export const LOGIN_RESULTS = [
  'success',
  'bad_password',
  'unknown_user',
  'locked',
  'disabled',
  'mfa_required',
  'mfa_failed',
] as const;
export type LoginResult = (typeof LOGIN_RESULTS)[number];

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const TENANT_STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ['active', 'invited', 'suspended'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Data scopes for a granted permission (widest → narrowest defined in AUTHORIZATION.md). */
export const PERMISSION_SCOPES = [
  'self',
  'direct_reports',
  'indirect_reports',
  'department',
  'business_unit',
  'location',
  'company',
  'tenant',
] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const COMPANY_STATUSES = ['active', 'inactive'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const WORK_MODES = ['onsite', 'remote', 'hybrid'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EMPLOYEE_STATUSES = [
  'preboarding',
  'active',
  'on_leave',
  'suspended',
  'exited',
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

export const CUSTOM_FIELD_ENTITIES = [
  'employee',
  'candidate',
  'job',
  'asset',
  'company',
  'department',
] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'user',
  'department',
  'location',
  'url',
  'email',
  'phone',
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const AUDIT_SOURCES = ['web', 'mobile', 'api', 'system', 'platform_admin'] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const FILE_STATUSES = ['pending', 'clean', 'quarantined', 'deleted'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const ADDRESS_TYPES = ['current', 'permanent', 'work', 'other'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const CONTACT_TYPES = [
  'personal_email',
  'work_email',
  'personal_phone',
  'work_phone',
  'other',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Relationship sets for emergency contacts and dependents. */
export const RELATIONSHIPS = [
  'spouse',
  'child',
  'parent',
  'sibling',
  'grandparent',
  'guardian',
  'friend',
  'other',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
