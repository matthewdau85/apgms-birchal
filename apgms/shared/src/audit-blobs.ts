import { randomUUID } from "node:crypto";

export type AuditBlobKind = "anomaly" | (string & {});

export interface AuditBlobRecord {
  id: string;
  kind: AuditBlobKind;
  payloadJson: string;
  createdAt: Date;
}

export interface AuditAlertPayload {
  rule: "amount_corridor_breach" | "burst_frequency" | "new_payee";
  counterpartyId: string;
  transactionId: string;
  occurredAt: string;
  summary: string;
  context?: Record<string, unknown>;
}

export interface ListAlertsInput {
  page: number;
  pageSize: number;
  kind?: AuditBlobKind;
}

export interface AlertsPage {
  alerts: Array<{
    id: string;
    kind: AuditBlobKind;
    payload: AuditAlertPayload;
    createdAt: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
}

class AuditBlobStore {
  private blobs: AuditBlobRecord[] = [];

  record(kind: AuditBlobKind, payload: unknown): AuditBlobRecord {
    const entry: AuditBlobRecord = {
      id: randomUUID(),
      kind,
      payloadJson: JSON.stringify(payload),
      createdAt: new Date(),
    };
    this.blobs.push(entry);
    return entry;
  }

  recordAnomaly(payload: AuditAlertPayload): AuditBlobRecord {
    return this.record("anomaly", payload);
  }

  listAlerts({ page, pageSize, kind = "anomaly" }: ListAlertsInput): AlertsPage {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.max(1, Math.floor(pageSize) || 1);

    const filtered = this.blobs
      .filter((blob) => blob.kind === kind)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const start = (safePage - 1) * safePageSize;
    const selected = filtered.slice(start, start + safePageSize);

    return {
      alerts: selected.map((blob) => ({
        id: blob.id,
        kind: blob.kind,
        payload: JSON.parse(blob.payloadJson) as AuditAlertPayload,
        createdAt: blob.createdAt.toISOString(),
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  reset() {
    this.blobs = [];
  }
}

export const auditBlobStore = new AuditBlobStore();

export function createAuditBlobStore(): AuditBlobStore {
  return new AuditBlobStore();
}

export type AuditBlobWriter = Pick<AuditBlobStore, "record" | "recordAnomaly">;

export { AuditBlobStore };
