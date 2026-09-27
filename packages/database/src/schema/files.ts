/**
 * Files context — tenant-scoped **metadata** over object storage (R2 today,
 * anything later; storage lives behind an interface, CLAUDE.md §12). This table
 * never stores bytes, only where to find them.
 *
 * `company_id` is nullable: some files are tenant-wide (a logo, a policy PDF),
 * others belong to a single legal entity.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { inList, primaryId, timestamps, tzTimestamp, versionColumn } from './_shared';
import { tenants } from './tenant';
import { FILE_STATUSES, type FileStatus } from './enums';

export const files = pgTable(
  'files',
  {
    id: primaryId(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id'),
    /** Logical owner, e.g. `employee`, `company`, `candidate`. */
    ownerEntity: text('owner_entity').notNull(),
    ownerEntityId: uuid('owner_entity_id'),
    /** Object-storage key. Unique across the whole bucket namespace. */
    r2Key: text('r2_key').notNull().unique(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    checksumSha256: text('checksum_sha256'),
    /** Business classification (e.g. `payslip`, `offer_letter`, `id_proof`). */
    documentType: text('document_type'),
    documentCategory: text('document_category'),
    uploadedBy: uuid('uploaded_by'),
    /** Signed-URL / retention expiry; `null` = no expiry. */
    expiresAt: tzTimestamp('expires_at'),
    version: versionColumn(),
    status: text('status').$type<FileStatus>().notNull().default('pending'),
    retentionPolicy: text('retention_policy'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => [
    inList('files_status_chk', t.status, FILE_STATUSES),
    index('files_tenant_idx').on(t.tenantId),
    index('files_owner_idx').on(t.ownerEntity, t.ownerEntityId),
    // Deduplicate identical content within a tenant (best-effort; checksum is optional).
    uniqueIndex('files_tenant_checksum_unique')
      .on(t.tenantId, t.checksumSha256)
      .where(sql`${t.checksumSha256} IS NOT NULL AND ${t.status} <> 'deleted'`),
  ],
);
