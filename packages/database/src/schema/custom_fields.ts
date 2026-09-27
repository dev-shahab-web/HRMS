/**
 * Custom Fields context — tenant-defined **metadata**, not dynamic DDL.
 *
 * Nothing here ever runs `ALTER TABLE`. A tenant admin defines a field in
 * `custom_field_definitions`; values land in `custom_field_values.value` as
 * `jsonb`, keyed by `(definition_id, entity_id)`. This keeps every tenant on one
 * physical schema, which is what makes thousands of tenants on shared Postgres
 * maintainable (CLAUDE.md §1, §8).
 *
 * `entity` is duplicated onto the value row on purpose: it lets us query "all
 * custom values for this employee" without joining the definition table, and it
 * is covered by a check constraint against the canonical entity list.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps } from './_shared';
import { tenants } from './tenant';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  type CustomFieldEntity,
  type CustomFieldType,
} from './enums';

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entity: text('entity').$type<CustomFieldEntity>().notNull(),
    /** Machine key, e.g. `passport_number`. Stable across label changes. */
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: text('type').$type<CustomFieldType>().notNull(),
    /**
     * Type-specific configuration: `options` for select/multi_select,
     * `min`/`max`/`pattern` for validation, `defaultValue`, `currencyCode`.
     */
    config: jsonb('config').$type<Record<string, unknown>>(),
    required: boolean('required').notNull().default(false),
    /** Which roles/scopes may see the field, and on which surfaces (self-service, reports). */
    visibility: jsonb('visibility').$type<Record<string, unknown>>(),
    /** Sort order within the form/section. */
    order: integer('order').notNull().default(0),
    /** Marks the field as holding personal data for retention/export purposes. */
    isSensitive: boolean('is_sensitive').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('custom_field_definitions_tenant_entity_key_unique').on(t.tenantId, t.entity, t.key),
    inList('custom_field_definitions_entity_chk', t.entity, CUSTOM_FIELD_ENTITIES),
    inList('custom_field_definitions_type_chk', t.type, CUSTOM_FIELD_TYPES),
    index('custom_field_definitions_tenant_entity_idx').on(t.tenantId, t.entity),
  ],
);

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
    /** Denormalized from the definition so entity lookups need no join. */
    entity: text('entity').$type<CustomFieldEntity>().notNull(),
    /** The id of the owning record (employee, candidate, job, …). App-enforced. */
    entityId: uuid('entity_id').notNull(),
    /**
     * The value, shaped by the definition's type: a string, number, boolean,
     * ISO date string, or array for multi-select. `null` = explicitly cleared.
     */
    value: jsonb('value'),
    ...timestamps(),
  },
  (t) => [
    unique('custom_field_values_definition_entity_unique').on(t.definitionId, t.entityId),
    inList('custom_field_values_entity_chk', t.entity, CUSTOM_FIELD_ENTITIES),
    index('custom_field_values_lookup_idx').on(t.tenantId, t.entity, t.entityId),
    check(
      'custom_field_values_not_null_chk',
      sql`${t.value} IS NOT NULL AND ${t.value} <> 'null'::jsonb`,
    ),
  ],
);
