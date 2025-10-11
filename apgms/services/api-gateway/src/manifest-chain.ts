import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { canonicalStringify } from "./audit-log";

export interface ManifestInput {
  orgId: string;
  period: string;
  payload: Record<string, unknown>;
}

export interface ManifestRecord {
  id: string;
  orgId: string;
  period: string;
  sequence: number;
  digest: string;
  prevDigest: string | null;
  createdAt: Date;
  payload: Record<string, unknown>;
}

export interface ManifestRepository {
  findLatest(orgId: string, period: string): Promise<ManifestRecord | null>;
  create(input: ManifestPersisted): Promise<ManifestRecord>;
  getChain(orgId: string, period: string): Promise<ManifestRecord[]>;
}

export interface ManifestPersisted {
  orgId: string;
  period: string;
  sequence: number;
  digest: string;
  prevDigest: string | null;
  createdAt: Date;
  payload: Record<string, unknown>;
}

export class PrismaManifestRepository implements ManifestRepository {
  constructor(private readonly prisma: Pick<PrismaClient, "$queryRaw">) {}

  async findLatest(orgId: string, period: string): Promise<ManifestRecord | null> {
    const rows = await this.prisma.$queryRaw<
      ManifestRow[]
    >`
      SELECT "id", "orgId", "period", "sequence", "digest", "prevDigest", "createdAt", "payload"
      FROM "ManifestEntry"
      WHERE "orgId" = ${orgId} AND "period" = ${period}
      ORDER BY "sequence" DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return null;
    }
    return mapManifestFromPrisma(rows[0]);
  }

  async create(input: ManifestPersisted): Promise<ManifestRecord> {
    const payloadJson = JSON.stringify(input.payload);
    const rows = await this.prisma.$queryRaw<
      ManifestRow[]
    >`
      INSERT INTO "ManifestEntry" (
        "orgId",
        "period",
        "sequence",
        "digest",
        "prevDigest",
        "createdAt",
        "payload"
      )
      VALUES (
        ${input.orgId},
        ${input.period},
        ${input.sequence},
        ${input.digest},
        ${input.prevDigest},
        ${input.createdAt},
        ${payloadJson}
      )
      RETURNING "id", "orgId", "period", "sequence", "digest", "prevDigest", "createdAt", "payload"
    `;
    return mapManifestFromPrisma(rows[0]);
  }

  async getChain(orgId: string, period: string): Promise<ManifestRecord[]> {
    const rows = await this.prisma.$queryRaw<
      ManifestRow[]
    >`
      SELECT "id", "orgId", "period", "sequence", "digest", "prevDigest", "createdAt", "payload"
      FROM "ManifestEntry"
      WHERE "orgId" = ${orgId} AND "period" = ${period}
      ORDER BY "sequence" ASC
    `;
    return rows.map(mapManifestFromPrisma);
  }
}

type ManifestRow = {
  id: string;
  orgId: string;
  period: string;
  sequence: number;
  digest: string;
  prevDigest: string | null;
  createdAt: Date;
  payload: unknown;
};

export function mapManifestFromPrisma(entry: ManifestRow): ManifestRecord {
  let payloadObject: Record<string, unknown> = {};
  if (entry.payload && typeof entry.payload === "object") {
    payloadObject = entry.payload as Record<string, unknown>;
  } else if (typeof entry.payload === "string") {
    try {
      const parsed = JSON.parse(entry.payload);
      if (parsed && typeof parsed === "object") {
        payloadObject = parsed as Record<string, unknown>;
      }
    } catch (err) {
      // ignore malformed json and fall back to empty object
    }
  }
  return {
    id: entry.id,
    orgId: entry.orgId,
    period: entry.period,
    sequence: entry.sequence,
    digest: entry.digest,
    prevDigest: entry.prevDigest,
    createdAt: entry.createdAt,
    payload: payloadObject,
  };
}

export class ManifestChain {
  constructor(
    private readonly repository: ManifestRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async append(input: ManifestInput): Promise<ManifestRecord> {
    const latest = await this.repository.findLatest(input.orgId, input.period);
    const prevDigest = latest?.digest ?? null;
    const sequence = latest ? latest.sequence + 1 : 1;
    const createdAt = this.clock();
    const digest = createHash("sha256")
      .update(
        canonicalStringify({
          orgId: input.orgId,
          period: input.period,
          sequence,
          prevDigest,
          createdAt: createdAt.toISOString(),
          payload: input.payload,
        }),
      )
      .digest("hex");

    return this.repository.create({
      orgId: input.orgId,
      period: input.period,
      sequence,
      prevDigest,
      createdAt,
      digest,
      payload: input.payload,
    });
  }

  async getChain(orgId: string, period: string): Promise<ManifestRecord[]> {
    return this.repository.getChain(orgId, period);
  }
}
