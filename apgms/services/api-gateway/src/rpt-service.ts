import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuditLogWriter } from "./audit-log";
import type { ManifestChain, ManifestRecord } from "./manifest-chain";
import { mapManifestFromPrisma } from "./manifest-chain";

export interface RptRecord {
  id: string;
  orgId: string;
  period: string;
  status: "ACTIVE" | "REVOKED";
  token: string;
  mintedAt: Date;
  mintedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokedReason: string | null;
  manifest: ManifestRecord;
}

export interface RptRepository {
  create(input: RptCreateInput): Promise<RptRecord>;
  findByToken(token: string): Promise<RptRecord | null>;
  markRevoked(id: string, update: RptRevokeUpdate): Promise<RptRecord>;
}

export interface RptCreateInput {
  orgId: string;
  period: string;
  token: string;
  manifestId: string;
  mintedAt: Date;
  mintedBy: string;
}

export interface RptRevokeUpdate {
  revokedAt: Date;
  revokedBy: string;
  revokedReason?: string;
}

export class PrismaRptRepository implements RptRepository {
  constructor(private readonly prisma: Pick<PrismaClient, "$queryRaw">) {}

  async create(input: RptCreateInput): Promise<RptRecord> {
    const rows = await this.prisma.$queryRaw<RptRow[]>`
      WITH inserted AS (
        INSERT INTO "RptToken" (
          "orgId",
          "period",
          "manifestId",
          "token",
          "mintedAt",
          "mintedBy"
        )
        VALUES (
          ${input.orgId},
          ${input.period},
          ${input.manifestId},
          ${input.token},
          ${input.mintedAt},
          ${input.mintedBy}
        )
        RETURNING *
      )
      SELECT
        inserted."id",
        inserted."orgId",
        inserted."period",
        inserted."token",
        inserted."status",
        inserted."mintedAt",
        inserted."mintedBy",
        inserted."revokedAt",
        inserted."revokedBy",
        inserted."revokedReason",
        manifest."id"        AS "manifest_id",
        manifest."orgId"     AS "manifest_orgId",
        manifest."period"    AS "manifest_period",
        manifest."sequence"  AS "manifest_sequence",
        manifest."digest"    AS "manifest_digest",
        manifest."prevDigest" AS "manifest_prevDigest",
        manifest."createdAt" AS "manifest_createdAt",
        manifest."payload"   AS "manifest_payload"
      FROM inserted
      JOIN "ManifestEntry" manifest ON manifest."id" = inserted."manifestId"
    `;
    return mapRpt(rows[0]);
  }

  async findByToken(token: string): Promise<RptRecord | null> {
    const rows = await this.prisma.$queryRaw<RptRow[]>`
      SELECT
        rpt."id",
        rpt."orgId",
        rpt."period",
        rpt."token",
        rpt."status",
        rpt."mintedAt",
        rpt."mintedBy",
        rpt."revokedAt",
        rpt."revokedBy",
        rpt."revokedReason",
        manifest."id"        AS "manifest_id",
        manifest."orgId"     AS "manifest_orgId",
        manifest."period"    AS "manifest_period",
        manifest."sequence"  AS "manifest_sequence",
        manifest."digest"    AS "manifest_digest",
        manifest."prevDigest" AS "manifest_prevDigest",
        manifest."createdAt" AS "manifest_createdAt",
        manifest."payload"   AS "manifest_payload"
      FROM "RptToken" rpt
      JOIN "ManifestEntry" manifest ON manifest."id" = rpt."manifestId"
      WHERE rpt."token" = ${token}
    `;
    if (rows.length === 0) {
      return null;
    }
    return mapRpt(rows[0]);
  }

  async markRevoked(id: string, update: RptRevokeUpdate): Promise<RptRecord> {
    const rows = await this.prisma.$queryRaw<RptRow[]>`
      WITH updated AS (
        UPDATE "RptToken"
        SET
          "status" = 'REVOKED',
          "revokedAt" = ${update.revokedAt},
          "revokedBy" = ${update.revokedBy},
          "revokedReason" = ${update.revokedReason ?? null}
        WHERE "id" = ${id}
        RETURNING *
      )
      SELECT
        updated."id",
        updated."orgId",
        updated."period",
        updated."token",
        updated."status",
        updated."mintedAt",
        updated."mintedBy",
        updated."revokedAt",
        updated."revokedBy",
        updated."revokedReason",
        manifest."id"        AS "manifest_id",
        manifest."orgId"     AS "manifest_orgId",
        manifest."period"    AS "manifest_period",
        manifest."sequence"  AS "manifest_sequence",
        manifest."digest"    AS "manifest_digest",
        manifest."prevDigest" AS "manifest_prevDigest",
        manifest."createdAt" AS "manifest_createdAt",
        manifest."payload"   AS "manifest_payload"
      FROM updated
      JOIN "ManifestEntry" manifest ON manifest."id" = updated."manifestId"
    `;
    return mapRpt(rows[0]);
  }
}

type RptRow = {
  id: string;
  orgId: string;
  period: string;
  token: string;
  status: "ACTIVE" | "REVOKED";
  mintedAt: Date;
  mintedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokedReason: string | null;
  manifest_id: string;
  manifest_orgId: string;
  manifest_period: string;
  manifest_sequence: number;
  manifest_digest: string;
  manifest_prevDigest: string | null;
  manifest_createdAt: Date;
  manifest_payload: unknown;
};

function mapRpt(row: RptRow): RptRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    period: row.period,
    token: row.token,
    status: row.status,
    mintedAt: row.mintedAt,
    mintedBy: row.mintedBy,
    revokedAt: row.revokedAt,
    revokedBy: row.revokedBy,
    revokedReason: row.revokedReason,
    manifest: mapManifestFromPrisma({
      id: row.manifest_id,
      orgId: row.manifest_orgId,
      period: row.manifest_period,
      sequence: row.manifest_sequence,
      digest: row.manifest_digest,
      prevDigest: row.manifest_prevDigest,
      createdAt: row.manifest_createdAt,
      payload: row.manifest_payload,
    }),
  };
}

export interface MintRequest {
  orgId: string;
  period: string;
  payload: Record<string, unknown>;
  actor: string;
}

export interface VerifyRequest {
  token: string;
}

export interface RevokeRequest {
  token: string;
  actor: string;
  reason?: string;
}

export class RptService {
  constructor(
    private readonly deps: {
      manifestChain: ManifestChain;
      auditLog: AuditLogWriter;
      repository: RptRepository;
      tokenGenerator?: () => string;
      clock?: () => Date;
    },
  ) {}

  private get clock(): () => Date {
    return this.deps.clock ?? (() => new Date());
  }

  private get tokenGenerator(): () => string {
    return (
      this.deps.tokenGenerator ?? (() => randomBytes(24).toString("hex"))
    );
  }

  async mint(request: MintRequest): Promise<{
    token: string;
    manifest: ManifestRecord;
  }> {
    const manifest = await this.deps.manifestChain.append({
      orgId: request.orgId,
      period: request.period,
      payload: request.payload,
    });

    const token = this.tokenGenerator();
    const mintedAt = this.clock();

    const rpt = await this.deps.repository.create({
      orgId: request.orgId,
      period: request.period,
      token,
      manifestId: manifest.id,
      mintedAt,
      mintedBy: request.actor,
    });

    await this.deps.auditLog.append({
      actor: request.actor,
      action: "rpt.mint",
      entityType: "RPT",
      entityId: rpt.id,
      metadata: {
        token,
        orgId: request.orgId,
        period: request.period,
        manifestDigest: manifest.digest,
      },
    });

    return { token, manifest };
  }

  async verify(request: VerifyRequest): Promise<
    | { valid: false; reason: "not_found" | "revoked"; revokedAt?: Date; revokedReason?: string | null }
    | {
        valid: true;
        orgId: string;
        period: string;
        manifestDigest: string;
        mintedAt: Date;
      }
  > {
    const rpt = await this.deps.repository.findByToken(request.token);
    if (!rpt) {
      return { valid: false, reason: "not_found" };
    }
    if (rpt.status === "REVOKED") {
      return {
        valid: false,
        reason: "revoked",
        revokedAt: rpt.revokedAt ?? undefined,
        revokedReason: rpt.revokedReason,
      };
    }
    return {
      valid: true,
      orgId: rpt.orgId,
      period: rpt.period,
      manifestDigest: rpt.manifest.digest,
      mintedAt: rpt.mintedAt,
    };
  }

  async revoke(request: RevokeRequest): Promise<
    | { ok: true; revokedAt: Date }
    | { ok: false; reason: "not_found" | "already_revoked"; revokedAt?: Date }
  > {
    const rpt = await this.deps.repository.findByToken(request.token);
    if (!rpt) {
      return { ok: false, reason: "not_found" };
    }
    if (rpt.status === "REVOKED") {
      return {
        ok: false,
        reason: "already_revoked",
        revokedAt: rpt.revokedAt ?? undefined,
      };
    }

    const revokedAt = this.clock();
    const updated = await this.deps.repository.markRevoked(rpt.id, {
      revokedAt,
      revokedBy: request.actor,
      revokedReason: request.reason,
    });

    await this.deps.auditLog.append({
      actor: request.actor,
      action: "rpt.revoke",
      entityType: "RPT",
      entityId: updated.id,
      metadata: {
        token: request.token,
        reason: request.reason ?? null,
        orgId: updated.orgId,
        period: updated.period,
      },
    });

    return { ok: true, revokedAt };
  }
}
