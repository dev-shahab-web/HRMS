/**
 * Typed domain errors. Application/HTTP layers map these to the standardized
 * API error envelope: `{ error: { code, message, requestId, details } }`.
 * Never throw bare strings; never leak internals in `message`. See `CLAUDE.md` §10.
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'TENANT_NOT_FOUND'
  | 'COMPANY_NOT_FOUND'
  | 'EMPLOYEE_NOT_FOUND'
  | 'FEATURE_NOT_ENABLED'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'CONFLICT'
  | 'CONCURRENCY_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYROLL_ALREADY_LOCKED'
  | 'ATTENDANCE_OUTSIDE_GEOFENCE'
  | 'LEAVE_BALANCE_INSUFFICIENT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface DomainErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

/** Base class for all domain errors. */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, options?: DomainErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.details = options?.details;
  }

  /** Safe serialization for API responses (no stack, no internals). */
  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export class Unauthenticated extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  readonly httpStatus = 401;
  constructor(message = 'Authentication is required.', options?: DomainErrorOptions) {
    super(message, options);
  }
}

export class Forbidden extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
  constructor(
    message = 'You do not have permission to perform this action.',
    options?: DomainErrorOptions,
  ) {
    super(message, options);
  }
}

export class ValidationFailed extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  readonly httpStatus = 422;
  constructor(message = 'The request failed validation.', options?: DomainErrorOptions) {
    super(message, options);
  }
}

export class NotFound extends DomainError {
  readonly code: ErrorCode = 'NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'The requested resource was not found.', options?: DomainErrorOptions) {
    super(message, options);
  }
}

export class TenantNotFound extends NotFound {
  override readonly code = 'TENANT_NOT_FOUND';
  constructor(tenantId?: string) {
    super(tenantId ? `Tenant ${tenantId} was not found.` : 'Tenant was not found.');
  }
}

export class CompanyNotFound extends NotFound {
  override readonly code = 'COMPANY_NOT_FOUND';
  constructor(companyId?: string) {
    super(companyId ? `Company ${companyId} was not found.` : 'Company was not found.');
  }
}

export class EmployeeNotFound extends NotFound {
  override readonly code = 'EMPLOYEE_NOT_FOUND';
  constructor(employeeId?: string) {
    super(employeeId ? `Employee ${employeeId} was not found.` : 'Employee was not found.');
  }
}

export class FeatureNotEnabled extends DomainError {
  readonly code = 'FEATURE_NOT_ENABLED';
  readonly httpStatus = 402;
  constructor(featureKey: string, options?: DomainErrorOptions) {
    super(`The "${featureKey}" feature is not enabled for this subscription.`, {
      ...options,
      details: { featureKey, ...options?.details },
    });
  }
}

export class UsageLimitExceeded extends DomainError {
  readonly code = 'USAGE_LIMIT_EXCEEDED';
  readonly httpStatus = 402;
  constructor(featureKey: string, limit: number, current: number, options?: DomainErrorOptions) {
    super(`Usage limit reached for "${featureKey}" (${current}/${limit}).`, {
      ...options,
      details: { featureKey, limit, current, ...options?.details },
    });
  }
}

export class ConflictError extends DomainError {
  readonly code: ErrorCode = 'CONFLICT';
  readonly httpStatus = 409;
  constructor(message = 'The request conflicts with the current state.', options?: DomainErrorOptions) {
    super(message, options);
  }
}

export class ConcurrencyConflict extends ConflictError {
  override readonly code = 'CONCURRENCY_CONFLICT';
  constructor(message = 'The record was modified by someone else. Reload and try again.') {
    super(message);
  }
}

export class IdempotencyConflict extends ConflictError {
  override readonly code = 'IDEMPOTENCY_CONFLICT';
  constructor(message = 'A different request already used this idempotency key.') {
    super(message);
  }
}

export class RateLimited extends DomainError {
  readonly code = 'RATE_LIMITED';
  readonly httpStatus = 429;
  constructor(message = 'Too many requests. Please slow down.', options?: DomainErrorOptions) {
    super(message, options);
  }
}

/**
 * Module-specific business-rule errors. Defined here so every typed error code
 * has a concrete class and a single import site, even though the rules that
 * raise them live in their bounded contexts (payroll, attendance, leave).
 */

export class PayrollAlreadyLocked extends ConflictError {
  override readonly code = 'PAYROLL_ALREADY_LOCKED';
  constructor(message = 'This payroll run is locked and can no longer be modified.') {
    super(message);
  }
}

export class AttendanceOutsideGeofence extends DomainError {
  readonly code = 'ATTENDANCE_OUTSIDE_GEOFENCE';
  readonly httpStatus = 422;
  constructor(
    message = 'You are outside the permitted location for this action.',
    options?: DomainErrorOptions,
  ) {
    super(message, options);
  }
}

export class LeaveBalanceInsufficient extends DomainError {
  readonly code = 'LEAVE_BALANCE_INSUFFICIENT';
  readonly httpStatus = 422;
  constructor(
    message = 'The available leave balance is insufficient for this request.',
    options?: DomainErrorOptions,
  ) {
    super(message, options);
  }
}

/** Not for clients: represents an unexpected internal failure. */
export class InternalError extends DomainError {
  readonly code = 'INTERNAL';
  readonly httpStatus = 500;
  constructor(message = 'An internal error occurred.', options?: DomainErrorOptions) {
    super(message, options);
  }
}
