import { prisma } from "../../shared/src/db";
import type {
  AlertFilters,
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  AlertStatusChange,
} from "../../shared/src/alerts";

export type PrismaAlertModel = {
  id: string;
  orgId: string;
  ruleId: string;
  summary: string;
  details: string | null;
  status: AlertStatus;
  severity: AlertSeverity;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  readAt: Date | null;
  bankLineId: string | null;
};

type AlertClient = {
  create: (args: { data: Record<string, unknown> }) => Promise<PrismaAlertModel>;
  findMany: (args: Record<string, unknown>) => Promise<PrismaAlertModel[]>;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<PrismaAlertModel>;
  updateMany: (
    args: { where: Record<string, unknown>; data: Record<string, unknown> }
  ) => Promise<{ count: number }>;
  count: (args: Record<string, unknown>) => Promise<number>;
};

export interface AlertsRepository {
  alert: AlertClient;
}

export interface CreateAlertInput {
  orgId: string;
  ruleId: string;
  summary: string;
  details?: string | null;
  severity?: AlertSeverity;
  status?: AlertStatus;
  metadata?: Record<string, unknown> | null;
  bankLineId?: string | null;
  createdAt?: Date;
}

export interface ListAlertsOptions extends AlertFilters {
  order?: "asc" | "desc";
}

const mapAlertRecord = (alert: PrismaAlertModel): AlertRecord => ({
  id: alert.id,
  orgId: alert.orgId,
  ruleId: alert.ruleId,
  summary: alert.summary,
  details: alert.details,
  status: alert.status,
  severity: alert.severity,
  metadata: alert.metadata,
  createdAt: alert.createdAt,
  updatedAt: alert.updatedAt,
  readAt: alert.readAt,
  bankLineId: alert.bankLineId,
});

const defaultClient = prisma as unknown as AlertsRepository;

const buildWhereClause = (filters: AlertFilters): Record<string, unknown> => {
  const where: Record<string, unknown> = {};
  if (filters.orgId) {
    where.orgId = filters.orgId;
  }
  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }
  if (filters.ruleIds?.length) {
    where.ruleId = { in: filters.ruleIds };
  }
  if (filters.severity?.length) {
    where.severity = { in: filters.severity };
  }
  if (filters.search) {
    where.OR = [
      { summary: { contains: filters.search, mode: "insensitive" } },
      { details: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
};

export const createAlert = async (
  input: CreateAlertInput,
  client: AlertsRepository = defaultClient
): Promise<AlertRecord> => {
  const now = input.createdAt ?? new Date();
  const result = await client.alert.create({
    data: {
      orgId: input.orgId,
      ruleId: input.ruleId,
      summary: input.summary,
      details: input.details ?? null,
      severity: input.severity ?? "MEDIUM",
      status: input.status ?? "UNREAD",
      metadata: input.metadata ?? null,
      bankLineId: input.bankLineId ?? null,
      createdAt: now,
    },
  });
  return mapAlertRecord(result);
};

export const listAlerts = async (
  filters: ListAlertsOptions = {},
  client: AlertsRepository = defaultClient
): Promise<AlertRecord[]> => {
  const where = buildWhereClause(filters);
  const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const skip = Math.max(filters.offset ?? 0, 0);
  const order = filters.order ?? "desc";
  const records = await client.alert.findMany({
    where,
    orderBy: { createdAt: order },
    take,
    skip,
  });
  return records.map(mapAlertRecord);
};

export const markAlertStatus = async (
  id: string,
  status: AlertStatus,
  client: AlertsRepository = defaultClient
): Promise<AlertRecord> => {
  const readAt = status === "READ" ? new Date() : null;
  const updated = await client.alert.update({
    where: { id },
    data: {
      status,
      readAt,
    },
  });
  return mapAlertRecord(updated);
};

export const markManyAlerts = async (
  changes: AlertStatusChange[],
  client: AlertsRepository = defaultClient
): Promise<number> => {
  if (!changes.length) return 0;
  let total = 0;
  for (const change of changes) {
    const readAt = change.status === "READ" ? change.readAt ?? new Date() : null;
    const result = await client.alert.update({
      where: { id: change.id },
      data: {
        status: change.status,
        readAt,
      },
    });
    if (result) {
      total += 1;
    }
  }
  return total;
};

export const countUnreadAlerts = async (
  orgId: string,
  client: AlertsRepository = defaultClient
): Promise<number> => {
  const count = await client.alert.count({
    where: {
      orgId,
      status: "UNREAD",
    },
  });
  return count;
};
