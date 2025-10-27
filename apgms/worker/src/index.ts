import type { AuditEventSeverity } from '../../services/audit/src/index.js';
import { AuditService } from '../../services/audit/src/index.js';

export interface BasDeadline {
  id: string;
  entityId: string;
  dueDate: Date;
  status: 'PENDING' | 'SUBMITTED';
  description?: string;
  assignedTo?: string;
  lastAlertAt?: Date;
}

export class BasDeadlineRepository {
  private readonly deadlines = new Map<string, BasDeadline>();

  upsert(deadline: BasDeadline): void {
    this.deadlines.set(deadline.id, { ...deadline });
  }

  markSubmitted(id: string, submittedAt = new Date()): void {
    const record = this.deadlines.get(id);
    if (!record) {
      return;
    }

    record.status = 'SUBMITTED';
    record.lastAlertAt = submittedAt;
    this.deadlines.set(id, { ...record });
  }

  markAlerted(id: string, alertedAt = new Date()): void {
    const record = this.deadlines.get(id);
    if (!record) {
      return;
    }

    record.lastAlertAt = alertedAt;
    this.deadlines.set(id, { ...record });
  }

  getUpcoming(referenceDate: Date, withinDays: number, alertCooldownMs: number): BasDeadline[] {
    const horizon = new Date(referenceDate.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return [...this.deadlines.values()]
      .filter((deadline) => deadline.status === 'PENDING')
      .filter((deadline) => deadline.dueDate <= horizon && deadline.dueDate >= referenceDate)
      .filter((deadline) =>
        !deadline.lastAlertAt ||
        referenceDate.getTime() - deadline.lastAlertAt.getTime() >= alertCooldownMs,
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
}

export interface VerificationState {
  entityId: string;
  failureCount: number;
  lastFailureAt?: Date;
  holdActive: boolean;
  holdReason?: string;
  holdAppliedAt?: Date;
}

export class VerificationRepository {
  private readonly states = new Map<string, VerificationState>();

  recordFailure(entityId: string, occurredAt = new Date(), reason = 'MFA_FAILURE'): VerificationState {
    const previous = this.states.get(entityId) ?? {
      entityId,
      failureCount: 0,
      holdActive: false,
    };

    const next: VerificationState = {
      ...previous,
      failureCount: previous.failureCount + 1,
      lastFailureAt: occurredAt,
      holdReason: reason,
    };

    this.states.set(entityId, next);
    return next;
  }

  recordSuccess(entityId: string): { released: boolean; state: VerificationState } {
    const previous = this.states.get(entityId);
    if (!previous) {
      const baseline: VerificationState = {
        entityId,
        failureCount: 0,
        holdActive: false,
      };
      this.states.set(entityId, baseline);
      return { released: false, state: baseline };
    }

    const released = previous.holdActive;
    const next: VerificationState = {
      entityId,
      failureCount: 0,
      lastFailureAt: undefined,
      holdActive: false,
      holdReason: undefined,
      holdAppliedAt: previous.holdAppliedAt,
    };
    this.states.set(entityId, next);
    return { released, state: next };
  }

  markHold(entityId: string, appliedAt = new Date(), reason?: string): VerificationState {
    const current = this.states.get(entityId);
    if (!current) {
      throw new Error(`Attempted to apply hold for unknown entity: ${entityId}`);
    }

    const next: VerificationState = {
      ...current,
      holdActive: true,
      holdAppliedAt: appliedAt,
      holdReason: reason ?? current.holdReason,
    };
    this.states.set(entityId, next);
    return next;
  }

  getHoldCandidates(
    referenceDate: Date,
    failureThreshold: number,
    lookbackMs: number,
  ): VerificationState[] {
    return [...this.states.values()].filter((state) => {
      if (state.holdActive) {
        return false;
      }
      if (state.failureCount < failureThreshold) {
        return false;
      }
      if (!state.lastFailureAt) {
        return false;
      }
      const delta = referenceDate.getTime() - state.lastFailureAt.getTime();
      return delta <= lookbackMs;
    });
  }

  getState(entityId: string): VerificationState | undefined {
    const state = this.states.get(entityId);
    return state ? { ...state } : undefined;
  }
}

export interface ComplianceWorkerOptions {
  auditService: AuditService;
  deadlineRepository?: BasDeadlineRepository;
  verificationRepository?: VerificationRepository;
  deadlineAlertThresholdDays?: number;
  deadlineAlertCooldownMs?: number;
  deadlineCheckIntervalMs?: number;
  holdFailureThreshold?: number;
  holdFailureLookbackMs?: number;
  verificationCheckIntervalMs?: number;
  scheduler?: (task: () => Promise<void>, intervalMs: number) => SchedulerHandle;
}

export interface SchedulerHandle {
  dispose: () => void;
}

const defaultSchedule = (task: () => Promise<void>, intervalMs: number): SchedulerHandle => {
  const timer = setInterval(() => {
    void task();
  }, intervalMs);
  return {
    dispose: () => clearInterval(timer),
  };
};

export class ComplianceWorker {
  private readonly auditService: AuditService;
  private readonly deadlines: BasDeadlineRepository;
  private readonly verifications: VerificationRepository;
  private readonly scheduleTask: (task: () => Promise<void>, intervalMs: number) => SchedulerHandle;
  private readonly options: Required<
    Pick<
      ComplianceWorkerOptions,
      | 'deadlineAlertThresholdDays'
      | 'deadlineAlertCooldownMs'
      | 'deadlineCheckIntervalMs'
      | 'holdFailureThreshold'
      | 'holdFailureLookbackMs'
      | 'verificationCheckIntervalMs'
    >
  >;

  private deadlineHandle?: SchedulerHandle;
  private verificationHandle?: SchedulerHandle;

  constructor(options: ComplianceWorkerOptions) {
    this.auditService = options.auditService;
    this.deadlines = options.deadlineRepository ?? new BasDeadlineRepository();
    this.verifications = options.verificationRepository ?? new VerificationRepository();
    this.scheduleTask = options.scheduler ?? defaultSchedule;
    this.options = {
      deadlineAlertThresholdDays: options.deadlineAlertThresholdDays ?? 7,
      deadlineAlertCooldownMs: options.deadlineAlertCooldownMs ?? 24 * 60 * 60 * 1000,
      deadlineCheckIntervalMs: options.deadlineCheckIntervalMs ?? 6 * 60 * 60 * 1000,
      holdFailureThreshold: options.holdFailureThreshold ?? 3,
      holdFailureLookbackMs: options.holdFailureLookbackMs ?? 24 * 60 * 60 * 1000,
      verificationCheckIntervalMs: options.verificationCheckIntervalMs ?? 15 * 60 * 1000,
    };
  }

  start(): void {
    if (!this.deadlineHandle) {
      this.deadlineHandle = this.scheduleTask(
        () => this.processUpcomingBasDeadlines(),
        this.options.deadlineCheckIntervalMs,
      );
    }

    if (!this.verificationHandle) {
      this.verificationHandle = this.scheduleTask(
        () => this.enforceTemporaryHolds(),
        this.options.verificationCheckIntervalMs,
      );
    }
  }

  stop(): void {
    this.deadlineHandle?.dispose();
    this.verificationHandle?.dispose();
    this.deadlineHandle = undefined;
    this.verificationHandle = undefined;
  }

  registerDeadline(deadline: BasDeadline): void {
    this.deadlines.upsert(deadline);
  }

  async processUpcomingBasDeadlines(referenceDate = new Date()): Promise<void> {
    const upcoming = this.deadlines.getUpcoming(
      referenceDate,
      this.options.deadlineAlertThresholdDays,
      this.options.deadlineAlertCooldownMs,
    );

    for (const deadline of upcoming) {
      const daysRemaining = Math.ceil(
        (deadline.dueDate.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      const severity = determineSeverity(daysRemaining);
      await this.auditService.ingest({
        kind: 'COMPLIANCE',
        entityId: deadline.entityId,
        description: `BAS deadline approaching on ${deadline.dueDate.toISOString()}`,
        severity,
        metadata: {
          daysRemaining,
          deadlineId: deadline.id,
          assignedTo: deadline.assignedTo,
          description: deadline.description,
        },
      });
      this.deadlines.markAlerted(deadline.id, referenceDate);
    }
  }

  recordMfaFailure(entityId: string, occurredAt = new Date(), reason = 'MFA_FAILURE'): VerificationState {
    return this.verifications.recordFailure(entityId, occurredAt, reason);
  }

  async recordMfaSuccess(entityId: string): Promise<VerificationState> {
    const { released, state } = this.verifications.recordSuccess(entityId);
    if (released) {
      await this.auditService.ingest({
        kind: 'COMPLIANCE',
        entityId,
        description: 'Temporary hold lifted after successful verification',
        severity: 'LOW',
        metadata: {},
      });
    }
    return state;
  }

  async enforceTemporaryHolds(referenceDate = new Date()): Promise<void> {
    const candidates = this.verifications.getHoldCandidates(
      referenceDate,
      this.options.holdFailureThreshold,
      this.options.holdFailureLookbackMs,
    );

    for (const candidate of candidates) {
      this.verifications.markHold(candidate.entityId, referenceDate, candidate.holdReason);
      await this.auditService.ingest({
        kind: 'DISCREPANCY',
        entityId: candidate.entityId,
        description: 'Temporary hold applied after repeated verification failures',
        severity: 'HIGH',
        metadata: {
          failureCount: candidate.failureCount,
          lastFailureAt: candidate.lastFailureAt?.toISOString(),
          reason: candidate.holdReason,
        },
      });
    }
  }

  getDeadlineRepository(): BasDeadlineRepository {
    return this.deadlines;
  }

  getVerificationRepository(): VerificationRepository {
    return this.verifications;
  }
}

const determineSeverity = (daysRemaining: number): AuditEventSeverity => {
  if (daysRemaining <= 1) {
    return 'HIGH';
  }
  if (daysRemaining <= 3) {
    return 'MEDIUM';
  }
  return 'LOW';
};
