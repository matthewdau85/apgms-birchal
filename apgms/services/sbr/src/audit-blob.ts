import { createHash, randomUUID } from "node:crypto";

export type AuditBlobScope = "sbr.bas";
export type AuditBlobKind = "request" | "receipt";

export interface AuditBlobInput {
  scope: AuditBlobScope;
  referenceId: string;
  kind: AuditBlobKind;
  payload: string;
}

export interface AuditBlobRecord extends AuditBlobInput {
  id: string;
  sha256: string;
  createdAt: Date;
}

export interface IntegrityReport {
  ok: boolean;
  expectedSha256: string;
  actualSha256: string;
}

export class AuditBlobMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditBlobMutationError";
  }
}

export interface AuditBlobRepository {
  create(input: AuditBlobInput): Promise<AuditBlobRecord>;
  findById(id: string): Promise<AuditBlobRecord | null>;
  findByReference(
    scope: AuditBlobScope,
    referenceId: string,
    kind: AuditBlobKind
  ): Promise<AuditBlobRecord | null>;
}

export class InMemoryAuditBlobRepository implements AuditBlobRepository {
  private readonly records = new Map<string, AuditBlobRecord>();
  private readonly referenceIndex = new Map<string, string>();

  async create(input: AuditBlobInput): Promise<AuditBlobRecord> {
    const key = this.referenceKey(input.scope, input.referenceId, input.kind);
    if (this.referenceIndex.has(key)) {
      throw new AuditBlobMutationError("Audit blob already exists for reference");
    }
    const sha256 = createHash("sha256").update(input.payload).digest("hex");
    const record: AuditBlobRecord = {
      ...input,
      id: randomUUID(),
      sha256,
      createdAt: new Date(),
    };
    this.records.set(record.id, record);
    this.referenceIndex.set(key, record.id);
    return record;
  }

  async findById(id: string): Promise<AuditBlobRecord | null> {
    return this.records.get(id) ?? null;
  }

  async findByReference(
    scope: AuditBlobScope,
    referenceId: string,
    kind: AuditBlobKind
  ): Promise<AuditBlobRecord | null> {
    const key = this.referenceKey(scope, referenceId, kind);
    const id = this.referenceIndex.get(key);
    if (!id) return null;
    return this.findById(id);
  }

  // Expose records map for tests to simulate corruption.
  get unsafeRecords(): Map<string, AuditBlobRecord> {
    return this.records;
  }

  private referenceKey(scope: string, referenceId: string, kind: string): string {
    return `${scope}:${referenceId}:${kind}`;
  }
}

export function evaluateIntegrity(record: AuditBlobRecord): IntegrityReport {
  const actualSha256 = createHash("sha256").update(record.payload).digest("hex");
  return {
    ok: actualSha256 === record.sha256,
    expectedSha256: record.sha256,
    actualSha256,
  };
}
