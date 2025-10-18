import { randomUUID } from "node:crypto";

import type { Allocation } from "shared/policy-engine/index.js";
import type { RptToken } from "./rpt.js";

export interface LedgerEntry {
  ledgerEntryId: string;
  orgId: string;
  bankLineId: string;
  bucket: string;
  amountCents: number;
  currency: "AUD";
  createdAt: string;
}

export interface AuditBlob {
  auditId: string;
  createdAt: string;
  type: "RPT";
  rptId: string;
  rptDigest: string;
  payload: RptToken;
}

const ledgerEntries: LedgerEntry[] = [];
const auditBlobs: AuditBlob[] = [];

export function createLedgerEntries(options: {
  orgId: string;
  bankLineId: string;
  allocations: Allocation[];
  timestamp: string;
}): LedgerEntry[] {
  return options.allocations.map((allocation) => ({
    ledgerEntryId: randomUUID(),
    orgId: options.orgId,
    bankLineId: options.bankLineId,
    bucket: allocation.bucket,
    amountCents: allocation.amountCents,
    currency: allocation.currency,
    createdAt: options.timestamp,
  }));
}

export function persistLedgerEntries(entries: LedgerEntry[]): void {
  ledgerEntries.push(...entries);
}

export function listLedgerEntries(): LedgerEntry[] {
  return [...ledgerEntries];
}

export function createAuditBlob(rpt: RptToken, timestamp: string): AuditBlob {
  return {
    auditId: randomUUID(),
    createdAt: timestamp,
    type: "RPT",
    rptId: rpt.rptId,
    rptDigest: rpt.digest,
    payload: rpt,
  };
}

export function appendAuditBlob(blob: AuditBlob): void {
  auditBlobs.push(blob);
}

export function listAuditBlobs(): AuditBlob[] {
  return [...auditBlobs];
}

export function resetPersistence(): void {
  ledgerEntries.length = 0;
  auditBlobs.length = 0;
}
