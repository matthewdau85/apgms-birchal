import { randomUUID } from "node:crypto";
import { Allocation } from "../../../../shared/policy-engine/index";

export interface LedgerEntry {
  id: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  createdAt: string;
  rptHash: string;
}

const ledgerStore = new Map<string, LedgerEntry>();

export function createLedgerEntry(entry: Omit<LedgerEntry, "id" | "createdAt">): LedgerEntry {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const record: LedgerEntry = { ...entry, id, createdAt };
  ledgerStore.set(id, record);
  return record;
}

export function listLedgerEntries(): LedgerEntry[] {
  return Array.from(ledgerStore.values());
}

export function resetLedgerStore(): void {
  ledgerStore.clear();
}

export function storeLedgerEntry(entry: LedgerEntry): void {
  ledgerStore.set(entry.id, entry);
}
