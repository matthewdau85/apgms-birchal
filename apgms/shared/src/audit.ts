import crypto from "node:crypto";

export interface AuditEntryInput {
  id: string;
  actor: string;
  orgId: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface AuditEntry extends AuditEntryInput {
  hash: string;
  previousHash: string;
}

export interface AuditVerificationResult {
  ok: boolean;
  failures: string[];
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  const normalized = JSON.stringify(normalize(entry));
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export class AuditChain {
  private readonly entries: AuditEntry[] = [];

  append(input: AuditEntryInput): AuditEntry {
    const previousHash = this.entries.at(-1)?.hash ?? "GENESIS";
    const partial: Omit<AuditEntry, "hash"> = { ...input, previousHash };
    const hash = hashEntry(partial);
    const entry: AuditEntry = { ...partial, hash };
    this.entries.push(entry);
    return entry;
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  verify(): AuditVerificationResult {
    const failures: string[] = [];
    let lastHash = "GENESIS";
    for (const entry of this.entries) {
      if (entry.previousHash !== lastHash) {
        failures.push(`broken_link:${entry.id}`);
      }
      const { hash: _ignored, ...rest } = entry;
      const recomputed = hashEntry(rest);
      if (recomputed !== entry.hash) {
        failures.push(`hash_mismatch:${entry.id}`);
      }
      lastHash = entry.hash;
    }
    return { ok: failures.length === 0, failures };
  }
}
