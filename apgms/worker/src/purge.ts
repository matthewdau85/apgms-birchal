import { fileURLToPath } from "node:url";

export type RetentionClassification = "logs" | "audit" | "blob";

export interface RetentionRule {
  model: string;
  field: string;
  retentionMs: number;
  classification: RetentionClassification;
}

export interface RetentionModel {
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
  count?: (args: { where: Record<string, unknown> }) => Promise<number>;
}

export interface RetentionClient {
  [model: string]: RetentionModel | undefined;
}

export interface PurgeOptions {
  dryRun?: boolean;
  now?: Date;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export const retentionRules: RetentionRule[] = [
  {
    model: "auditLog",
    field: "createdAt",
    retentionMs: 7 * YEAR_MS,
    classification: "audit",
  },
  {
    model: "blobObject",
    field: "createdAt",
    retentionMs: 180 * DAY_MS,
    classification: "blob",
  },
  {
    model: "appLog",
    field: "createdAt",
    retentionMs: 30 * DAY_MS,
    classification: "logs",
  },
];

export async function purgeRetention(
  client: RetentionClient,
  options: PurgeOptions = {}
): Promise<Array<Record<string, unknown>>> {
  const { dryRun = false, now = new Date(), logger } = options;
  const summary: Array<Record<string, unknown>> = [];

  for (const rule of retentionRules) {
    const model = client[rule.model];
    if (!model) {
      logger?.warn?.({ model: rule.model }, "retention model missing");
      continue;
    }

    const cutoff = new Date(now.getTime() - rule.retentionMs);
    const where = { [rule.field]: { lt: cutoff } };

    if (dryRun) {
      const matched = (await model.count?.({ where })) ?? 0;
      summary.push({
        model: rule.model,
        classification: rule.classification,
        matched,
        dryRun: true,
      });
      logger?.info?.({ model: rule.model, matched, dryRun: true }, "retention dry-run");
      continue;
    }

    const result = await model.deleteMany({ where });
    summary.push({
      model: rule.model,
      classification: rule.classification,
      deleted: result.count,
      dryRun: false,
    });
    logger?.info?.({ model: rule.model, deleted: result.count }, "retention purge complete");
  }

  return summary;
}

export async function runPurge(options: PurgeOptions = {}) {
  const { prisma } = await import("../../shared/src/db");
  return purgeRetention(prisma as unknown as RetentionClient, options);
}

if (process.argv[1]) {
  const entry = fileURLToPath(import.meta.url);
  const fromCli = process.argv[1] === entry;
  if (fromCli) {
    const dryRun = process.argv.includes("--dry-run");
    runPurge({ dryRun, logger: console })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
}
