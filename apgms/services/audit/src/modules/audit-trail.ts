import { auditEventContract, type AuditEventJob } from "@apgms/shared";

const events: AuditEventJob[] = [];

export function recordAuditEvent(event: AuditEventJob): AuditEventJob {
  const parsed = auditEventContract.schema.parse(event);
  events.push(parsed);
  return parsed;
}

export function listAuditEvents(): AuditEventJob[] {
  return [...events];
}

export function resetAuditEvents(): void {
  events.length = 0;
}
