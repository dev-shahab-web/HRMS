/**
 * Audit context — **append-only**. There is no `updated_at` here on purpose:
 * an audit row is never modified.
 *
 * `tenant_id` is nullable because platform-level actions (a super admin
 * suspending a tenant, editing a plan) have no tenant. `before`/`after` hold
 * masked snapshots only — passwords, tokens, full bank numbers and raw
 * government ids must never be written here (CLAUDE.md §9).
 *
 * Immutability is enforced in three places: the app never issues UPDATE/DELETE
 * against this table, the migration revokes those privileges from the
 * application role, and `packages/database` exposes no mutating repository for
 * it. The RLS policy in `src/rls/policies.ts` is likewise read-only plus insert.
 */

import { index, jsonb, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

import { inList, primaryId, tzTimestamp } from './_shared';
import { users } from './identity';
import { AUDIT_SOURCES, type AuditSource } from './enums';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: primaryId(),
    /** `null` = a platform-level action. */
    tenantId: uuid('tenant_id'),
    companyId: uuid('company_id'),
    /** `null` for system/queue work with no human actor. */
    actorUserId: uuid('actor_user_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    /** Human-readable actor for the log, e.g. `Priya (priya@acme.com)` or `system:payroll`. */
    actorLabel: text('actor_label'),
    /** Dotted action, e.g. `employee.updated`, `payroll.run.approved`. */
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    /** Masked snapshots. Never raw secrets or full PII (CLAUDE.md §9). */
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    /** Ties every row a single HTTP request produced together. */
    requestId: text('request_id'),
    /** Ties rows across services/queues for one logical operation. */
    correlationId: text('correlation_id'),
    ip: text('ip'),
    source: text('source').$type<AuditSource>().notNull().default('api'),
    createdAt: tzTimestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    inList('audit_events_source_chk', t.source, AUDIT_SOURCES),
    index('audit_events_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('audit_events_entity_idx').on(t.entityType, t.entityId),
    index('audit_events_actor_idx').on(t.actorUserId),
    index('audit_events_request_idx').on(t.requestId),
  ],
);
