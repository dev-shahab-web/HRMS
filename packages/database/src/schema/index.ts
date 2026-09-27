/**
 * Schema barrel — every table in the foundation, by bounded context.
 *
 * Import order matters only for readability; the modules themselves are
 * acyclic by construction (see the note in each file's header). `identity` is
 * the root: it holds no outward tenant FKs. Cross-context references that would
 * create a cycle are plain `uuid` columns whose integrity the app layer
 * enforces (`files` logos/avatars, `employees.head_employee_id`).
 */

export * from './enums';
export * from './_shared';

export * from './identity';
export * from './platform';
export * from './tenant';
export * from './files';
export * from './rbac';
export * from './organization';
export * from './employee';
export * from './custom_fields';
export * from './audit';
