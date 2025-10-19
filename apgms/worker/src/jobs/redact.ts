import { prisma } from "@apgms/shared/src/db";
import type { PrismaClient } from "@prisma/client";

type OrgClient = Pick<PrismaClient, "org">;

export interface RedactionJobOptions {
  prismaClient?: OrgClient;
  retentionDays?: number;
  now?: Date;
}

const DEFAULT_RETENTION_DAYS = 365;

export const runRedactionJob = async (options: RedactionJobOptions = {}) => {
  const client = options.prismaClient ?? prisma;
  const retention =
    options.retentionDays ?? Number(process.env.RETENTION_DAYS_PII ?? DEFAULT_RETENTION_DAYS);

  if (!Number.isFinite(retention) || retention < 0) {
    throw new Error("RETENTION_DAYS_PII must be a non-negative number");
  }

  const now = options.now ?? new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retention);

  const result = await client.org.updateMany({
    where: {
      deletedAt: { lte: cutoff },
      piiRedactedAt: null,
    },
    data: {
      piiRedactedAt: now,
    },
  });

  return result.count;
};
