import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface AuditEventInput {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown> | null;
}

export interface AuditEventRecord {
  id: string;
  digestAfter: string;
  digestBefore: string | null;
}

export interface AuditEventRepository {
  findLatest(): Promise<AuditEventRecord | null>;
  create(input: AuditEventPersisted): Promise<AuditEventRecord>;
}

export interface AuditEventPersisted extends AuditEventInput {
  occurredAt: Date;
  digestBefore: string | null;
  digestAfter: string;
}

export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: Pick<PrismaClient, "$queryRaw">) {}

  async findLatest(): Promise<AuditEventRecord | null> {
    const rows = await this.prisma.$queryRaw<
      { id: string; digestAfter: string; digestBefore: string | null }[]
    >`
      SELECT "id", "digestAfter", "digestBefore"
      FROM "AuditEvent"
      ORDER BY "occurredAt" DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return null;
    }
    const [{ id, digestAfter, digestBefore }] = rows;
    return { id, digestAfter, digestBefore };
  }

  async create(input: AuditEventPersisted): Promise<AuditEventRecord> {
    const metadataJson =
      input.metadata === undefined || input.metadata === null
        ? null
        : JSON.stringify(input.metadata);
    const rows = await this.prisma.$queryRaw<
      { id: string; digestAfter: string; digestBefore: string | null }[]
    >`
      INSERT INTO "AuditEvent" (
        "actor",
        "action",
        "entityType",
        "entityId",
        "occurredAt",
        "metadata",
        "digestBefore",
        "digestAfter"
      )
      VALUES (
        ${input.actor},
        ${input.action},
        ${input.entityType ?? null},
        ${input.entityId ?? null},
        ${input.occurredAt},
        ${metadataJson},
        ${input.digestBefore},
        ${input.digestAfter}
      )
      RETURNING "id", "digestAfter", "digestBefore"
    `;
    const [{ id, digestAfter, digestBefore }] = rows;
    return { id, digestAfter, digestBefore };
  }
}

export class AuditLogWriter {
  constructor(
    private readonly repository: AuditEventRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async append(event: AuditEventInput): Promise<AuditEventRecord> {
    const latest = await this.repository.findLatest();
    const digestBefore = latest?.digestAfter ?? null;
    const occurredAt = this.clock();
    const digestAfter = computeDigest({
      digestBefore,
      occurredAt,
      event,
    });

    return this.repository.create({
      ...event,
      occurredAt,
      digestBefore,
      digestAfter,
    });
  }
}

export function computeDigest({
  digestBefore,
  occurredAt,
  event,
}: {
  digestBefore: string | null;
  occurredAt: Date;
  event: AuditEventInput;
}): string {
  const payload = canonicalStringify({
    digestBefore,
    occurredAt: occurredAt.toISOString(),
    actor: event.actor,
    action: event.action,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    metadata: event.metadata ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => [key, val] as const)
    .sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0));
  const inner = entries
    .map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`)
    .join(",");
  return `{${inner}}`;
}
