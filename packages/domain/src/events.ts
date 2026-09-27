/**
 * Domain events: the in-process record of "something meaningful happened".
 * Handlers, the outbox, and async jobs (Cloudflare Queues) consume these.
 * Every event is tenant-scoped and carries who/when for auditing.
 */

import { newId } from './ids';
import { nowIso } from './time';
import type { IsoDateTime, Uuid } from './types';

export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  /** UUIDv7 event id (also the natural dedupe key for the outbox). */
  readonly id: Uuid;
  readonly name: TName;
  readonly occurredAt: IsoDateTime;
  /** Owning tenant. Always present — events never cross tenants. */
  readonly tenantId: Uuid;
  /** Owning company when applicable, else null (tenant-level event). */
  readonly companyId: Uuid | null;
  /** User who caused the event, or null for system-originated events. */
  readonly actorUserId: Uuid | null;
  readonly payload: TPayload;
}

export interface CreateDomainEventInput<TName extends string, TPayload> {
  name: TName;
  tenantId: Uuid;
  payload: TPayload;
  companyId?: Uuid | null;
  actorUserId?: Uuid | null;
  occurredAt?: IsoDateTime;
  id?: Uuid;
}

export function createDomainEvent<TName extends string, TPayload>(
  input: CreateDomainEventInput<TName, TPayload>,
): DomainEvent<TName, TPayload> {
  return {
    id: input.id ?? newId(),
    name: input.name,
    occurredAt: input.occurredAt ?? nowIso(),
    tenantId: input.tenantId,
    companyId: input.companyId ?? null,
    actorUserId: input.actorUserId ?? null,
    payload: input.payload,
  };
}

/**
 * Canonical event names, dot-namespaced by bounded context. Kept as a const map
 * so producers and consumers share one source of truth. Extended as modules land.
 */
export const DomainEventName = {
  // Identity / access
  UserRegistered: 'user.registered',
  UserInvited: 'user.invited',
  SessionStarted: 'session.started',
  // Tenant / subscription
  TenantCreated: 'tenant.created',
  TenantSuspended: 'tenant.suspended',
  SubscriptionChanged: 'subscription.changed',
  // Employee lifecycle
  EmployeeCreated: 'employee.created',
  EmployeeUpdated: 'employee.updated',
  EmployeeJoined: 'employee.joined',
  EmployeeTerminated: 'employee.terminated',
  // Attendance / time
  AttendanceRecorded: 'attendance.recorded',
  // Leave
  LeaveRequested: 'leave.requested',
  LeaveApproved: 'leave.approved',
  LeaveRejected: 'leave.rejected',
  // Recruitment
  CandidateApplied: 'candidate.applied',
  CandidateHired: 'candidate.hired',
  // Payroll
  PayrollRunApproved: 'payroll.run.approved',
  PayslipPublished: 'payslip.published',
} as const;

export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];
