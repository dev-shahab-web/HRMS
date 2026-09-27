import { v7 as uuidv7, validate as uuidValidate, version as uuidVersion } from 'uuid';

import type { Uuid } from './types';

/**
 * Generate a new primary-key identifier: UUIDv7 (time-ordered).
 *
 * Time-ordering gives good B-tree index locality for inserts, which matters at
 * SaaS scale. Generated in-app (no DB extension) so the model stays portable
 * across Postgres providers. See `docs/ASSUMPTIONS.md` and `CLAUDE.md` §7.
 */
export function newId(): Uuid {
  return uuidv7();
}

/** Type guard: is `value` a syntactically valid UUID string? */
export function isUuid(value: unknown): value is Uuid {
  return typeof value === 'string' && uuidValidate(value);
}

/** Is `value` specifically a v7 UUID? */
export function isUuidV7(value: unknown): value is Uuid {
  return typeof value === 'string' && uuidValidate(value) && uuidVersion(value) === 7;
}
