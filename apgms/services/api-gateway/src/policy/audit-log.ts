import { AuditEvent, Clock, GateReason, Role } from "./types";

export class AuditLog {
  private readonly events: AuditEvent[] = [];

  constructor(private readonly clock: Clock = () => new Date()) {}

  record(event: Omit<AuditEvent, "occurredAt"> & Partial<Pick<AuditEvent, "occurredAt">>): AuditEvent {
    const occurredAt =
      "occurredAt" in event && event.occurredAt instanceof Date
        ? event.occurredAt
        : this.clock();
    const stored = { ...event, occurredAt } as AuditEvent;
    this.events.push(stored);
    return { ...stored };
  }

  recordGateClosed(params: {
    gateId: string;
    actorRole: Role;
    reason: GateReason;
    opensAt: Date | null;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    return this.record({
      type: "GATE_CLOSED",
      gateId: params.gateId,
      actorRole: params.actorRole,
      reason: params.reason,
      opensAt: params.opensAt,
      metadata: params.metadata,
    });
  }

  recordGateOpened(params: {
    gateId: string;
    actorRole: Role;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    return this.record({
      type: "GATE_OPENED",
      gateId: params.gateId,
      actorRole: params.actorRole,
      metadata: params.metadata,
    });
  }

  all(): AuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }
}
