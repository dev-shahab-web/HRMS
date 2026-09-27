/**
 * Identity context (global). Login identity, deliberately **separate from
 * employment**. This module is the dependency root of the schema: it holds no
 * outward foreign keys to tenant-scoped tables, so `active_tenant_id` /
 * `tenant_id` / `avatar_file_id` here are plain `uuid` columns (their
 * referential integrity is enforced by the app layer + RLS), which keeps the
 * schema module graph acyclic.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps } from './_shared';
import {
  INVITATION_STATUSES,
  LOGIN_RESULTS,
  MFA_TYPES,
  USER_STATUSES,
  type InvitationStatus,
  type LoginResult,
  type MfaType,
  type UserStatus,
} from './enums';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: text('status').$type<UserStatus>().notNull().default('active'),
    fullName: text('full_name').notNull(),
    preferredName: text('preferred_name'),
    // FK → files.id enforced at the app layer (breaks the users↔files module cycle).
    avatarFileId: uuid('avatar_file_id'),
    locale: text('locale').notNull().default('en'),
    timezone: text('timezone').notNull().default('UTC'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    // Case-insensitive email uniqueness without requiring the citext extension.
    uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`),
    inList('users_status_chk', t.status, USER_STATUSES),
  ],
);

export const userCredentials = pgTable('user_credentials', {
  id: primaryId(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  /** Versioned hash string, e.g. `pbkdf2-sha256$210000$<salt>$<hash>`. Never logged. */
  passwordHash: text('password_hash').notNull(),
  passwordSetAt: timestamp('password_set_at', { withTimezone: true }).notNull().defaultNow(),
  mustChange: boolean('must_change').notNull().default(false),
  ...timestamps(),
});

export const userIdentities = pgTable(
  'user_identities',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => [
    unique('user_identities_provider_subject_unique').on(t.provider, t.providerSubject),
    index('user_identities_user_idx').on(t.userId),
  ],
);

export const mfaFactors = pgTable(
  'mfa_factors',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<MfaType>().notNull(),
    /** Encrypted at the app layer; never stored or logged in clear. */
    secretEncrypted: text('secret_encrypted').notNull(),
    label: text('label'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [inList('mfa_factors_type_chk', t.type, MFA_TYPES)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // FK → tenants.id enforced at the app layer (identity is the schema root module).
    activeTenantId: uuid('active_tenant_id'),
    /** SHA-256 of the opaque session token; the raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    mfaSatisfied: boolean('mfa_satisfied').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

export const loginAudit = pgTable(
  'login_audit',
  {
    id: primaryId(),
    // Nullable: a failed attempt may not map to a known user. No FK cascade (audit trail).
    userId: uuid('user_id'),
    emailAttempted: text('email_attempted'),
    result: text('result').$type<LoginResult>().notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    inList('login_audit_result_chk', t.result, LOGIN_RESULTS),
    index('login_audit_email_idx').on(t.emailAttempted),
    index('login_audit_created_idx').on(t.createdAt),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: primaryId(),
    // Tenant-scoped (RLS applies); FK → tenants.id enforced at the app layer.
    tenantId: uuid('tenant_id').notNull(),
    email: text('email').notNull(),
    roleIds: uuid('role_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    companyIds: uuid('company_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    invitedBy: uuid('invited_by').references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    status: text('status').$type<InvitationStatus>().notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('invitations_token_hash_unique').on(t.tokenHash),
    inList('invitations_status_chk', t.status, INVITATION_STATUSES),
    // At most one pending invite per (tenant, email).
    uniqueIndex('invitations_tenant_email_pending_unique')
      .on(t.tenantId, t.email)
      .where(sql`${t.status} = 'pending'`),
  ],
);
