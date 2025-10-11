import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuditEventRepository,
  AuditEventRecord,
  AuditLogWriter,
  AuditEventPersisted,
} from "../src/audit-log";
import {
  ManifestChain,
  ManifestRepository,
  ManifestRecord,
  ManifestPersisted,
} from "../src/manifest-chain";
import {
  MintRequest,
  RptRepository,
  RptService,
  RptRecord,
  RptCreateInput,
  RptRevokeUpdate,
} from "../src/rpt-service";

class InMemoryAuditRepository implements AuditEventRepository {
  private events: (AuditEventRecord & AuditEventPersisted)[] = [];

  async findLatest(): Promise<AuditEventRecord | null> {
    if (this.events.length === 0) {
      return null;
    }
    const { id, digestAfter, digestBefore } = this.events[this.events.length - 1];
    return { id, digestAfter, digestBefore };
  }

  async create(input: AuditEventPersisted): Promise<AuditEventRecord> {
    const record: AuditEventRecord & AuditEventPersisted = {
      id: `event-${this.events.length + 1}`,
      ...input,
    };
    this.events.push(record);
    const { id, digestAfter, digestBefore } = record;
    return { id, digestAfter, digestBefore };
  }

  all(): (AuditEventRecord & AuditEventPersisted)[] {
    return this.events;
  }
}

class InMemoryManifestRepository implements ManifestRepository {
  private store: ManifestRecord[] = [];
  private counter = 0;

  async findLatest(orgId: string, period: string): Promise<ManifestRecord | null> {
    const relevant = this.store
      .filter((entry) => entry.orgId === orgId && entry.period === period)
      .sort((a, b) => b.sequence - a.sequence);
    return relevant[0] ?? null;
  }

  async create(input: ManifestPersisted): Promise<ManifestRecord> {
    const record: ManifestRecord = {
      id: `manifest-${++this.counter}`,
      ...input,
    };
    this.store.push(record);
    return record;
  }

  async getChain(orgId: string, period: string): Promise<ManifestRecord[]> {
    return this.store
      .filter((entry) => entry.orgId === orgId && entry.period === period)
      .sort((a, b) => a.sequence - b.sequence);
  }

  getById(id: string): ManifestRecord | undefined {
    return this.store.find((entry) => entry.id === id);
  }
}

class InMemoryRptRepository implements RptRepository {
  private store: RptRecord[] = [];
  private counter = 0;

  constructor(private readonly manifestRepo: InMemoryManifestRepository) {}

  async create(input: RptCreateInput): Promise<RptRecord> {
    const manifest = this.manifestRepo.getById(input.manifestId);
    if (!manifest) {
      throw new Error("manifest not found");
    }
    const record: RptRecord = {
      id: `rpt-${++this.counter}`,
      orgId: input.orgId,
      period: input.period,
      status: "ACTIVE",
      token: input.token,
      mintedAt: input.mintedAt,
      mintedBy: input.mintedBy,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
      manifest,
    };
    this.store.push(record);
    return record;
  }

  async findByToken(token: string): Promise<RptRecord | null> {
    return this.store.find((record) => record.token === token) ?? null;
  }

  async markRevoked(id: string, update: RptRevokeUpdate): Promise<RptRecord> {
    const record = this.store.find((entry) => entry.id === id);
    if (!record) {
      throw new Error("rpt not found");
    }
    record.status = "REVOKED";
    record.revokedAt = update.revokedAt;
    record.revokedBy = update.revokedBy;
    record.revokedReason = update.revokedReason ?? null;
    return record;
  }
}

test("audit log writer maintains digest continuity", async () => {
  const auditRepo = new InMemoryAuditRepository();
  let tick = 0;
  const writer = new AuditLogWriter(auditRepo, () => {
    const base = Date.parse("2024-01-01T00:00:00Z");
    return new Date(base + tick++ * 1000);
  });

  await writer.append({ actor: "alice", action: "create" });
  await writer.append({ actor: "bob", action: "update", entityId: "doc-1" });
  await writer.append({ actor: "carol", action: "delete", metadata: { hard: true } });

  const events = auditRepo.all();
  assert.equal(events[0].digestBefore, null);
  assert.equal(events[1].digestBefore, events[0].digestAfter);
  assert.equal(events[2].digestBefore, events[1].digestAfter);
  assert.notEqual(events[0].digestAfter, events[1].digestAfter);
  assert.notEqual(events[1].digestAfter, events[2].digestAfter);
});

test("rpt service verifies active tokens", async () => {
  const auditRepo = new InMemoryAuditRepository();
  const manifestRepo = new InMemoryManifestRepository();
  let manifestTick = 0;
  const manifestChain = new ManifestChain(
    manifestRepo,
    () => new Date(Date.parse("2024-02-01T00:00:00Z") + manifestTick++ * 1000),
  );
  const rptRepo = new InMemoryRptRepository(manifestRepo);
  const service = new RptService({
    manifestChain,
    auditLog: new AuditLogWriter(auditRepo),
    repository: rptRepo,
    tokenGenerator: () => "token-1",
    clock: () => new Date("2024-02-15T12:00:00Z"),
  });

  const mintRequest: MintRequest = {
    orgId: "org-1",
    period: "2024-Q1",
    payload: { total: 1000 },
    actor: "issuer",
  };
  await service.mint(mintRequest);

  const verify = await service.verify({ token: "token-1" });
  assert.equal(verify.valid, true);
  if (verify.valid) {
    assert.equal(verify.orgId, "org-1");
    assert.equal(verify.period, "2024-Q1");
    assert.ok(verify.manifestDigest.length > 0);
  }

  const missing = await service.verify({ token: "unknown" });
  assert.deepEqual(missing, { valid: false, reason: "not_found" });
});

test("rpt service revokes tokens and blocks verification", async () => {
  const auditRepo = new InMemoryAuditRepository();
  const manifestRepo = new InMemoryManifestRepository();
  const manifestChain = new ManifestChain(
    manifestRepo,
    () => new Date("2024-03-01T00:00:00Z"),
  );
  const rptRepo = new InMemoryRptRepository(manifestRepo);
  const auditWriter = new AuditLogWriter(auditRepo);
  const service = new RptService({
    manifestChain,
    auditLog: auditWriter,
    repository: rptRepo,
    tokenGenerator: () => "token-2",
    clock: () => new Date("2024-03-10T10:00:00Z"),
  });

  await service.mint({
    orgId: "org-9",
    period: "2024-Q2",
    payload: { total: 42 },
    actor: "issuer",
  });

  const revoke = await service.revoke({
    token: "token-2",
    actor: "auditor",
    reason: "compromised",
  });
  assert.equal(revoke.ok, true);
  if (revoke.ok) {
    assert.equal(revoke.revokedAt.toISOString(), "2024-03-10T10:00:00.000Z");
  }

  const verify = await service.verify({ token: "token-2" });
  assert.equal(verify.valid, false);
  if (!verify.valid) {
    assert.equal(verify.reason, "revoked");
    assert.equal(verify.revokedReason, "compromised");
  }

  const second = await service.revoke({
    token: "token-2",
    actor: "auditor",
  });
  assert.deepEqual(second, {
    ok: false,
    reason: "already_revoked",
    revokedAt: new Date("2024-03-10T10:00:00Z"),
  });

  assert.equal(auditRepo.all().length, 2);
});
