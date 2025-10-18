import { prisma } from "@apgms/shared";
import {
  Allocation,
  AnomalyAlert,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
  AuditActionType,
  BankLine,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type DetectionContext = {
  actor?: string;
};

export class AnomalyDetector {
  constructor(private readonly client: PrismaClient = prisma) {}

  async evaluateBankLine(bankLineId: string, context: DetectionContext = {}): Promise<AnomalyAlert[]> {
    const bankLine = await this.client.bankLine.findUnique({ where: { id: bankLineId } });
    if (!bankLine) {
      throw new Error(`Bank line ${bankLineId} was not found`);
    }

    const allocations = await this.client.allocation.findMany({
      where: {
        orgId: bankLine.orgId,
        payee: bankLine.payee,
      },
    });

    if (allocations.length === 0) {
      return [];
    }

    const alerts: AnomalyAlert[] = [];
    for (const allocation of allocations) {
      const created = await this.evaluateAgainstAllocation(bankLine, allocation, context);
      alerts.push(...created);
    }
    return alerts;
  }

  private async evaluateAgainstAllocation(
    bankLine: BankLine,
    allocation: Allocation,
    context: DetectionContext,
  ): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const thresholdAlert = await this.evaluateThreshold(bankLine, allocation, context);
    if (thresholdAlert) {
      alerts.push(thresholdAlert);
    }

    const velocityAlert = await this.evaluateVelocity(bankLine, allocation, context);
    if (velocityAlert) {
      alerts.push(velocityAlert);
    }

    return alerts;
  }

  private async evaluateThreshold(
    bankLine: BankLine,
    allocation: Allocation,
    context: DetectionContext,
  ): Promise<AnomalyAlert | null> {
    if (!allocation.thresholdAmount) {
      return null;
    }

    const bankAmount = new Decimal(bankLine.amount.toString());
    const threshold = new Decimal(allocation.thresholdAmount.toString());
    const exceeds = bankAmount.greaterThan(threshold);
    if (!exceeds) {
      return null;
    }

    const existing = await this.client.anomalyAlert.findFirst({
      where: {
        bankLineId: bankLine.id,
        type: AnomalyType.THRESHOLD_BREACH,
      },
    });

    if (existing) {
      return null;
    }

    const metadata: Prisma.JsonObject = {
      allocationId: allocation.id,
      bankLineId: bankLine.id,
      payee: bankLine.payee,
      observedAmount: bankAmount.toString(),
      thresholdAmount: threshold.toString(),
    };

    return this.createAlert({
      allocation,
      bankLine,
      message: `Transaction for ${bankLine.payee} exceeded the configured threshold`,
      metadata,
      severity: AnomalySeverity.HIGH,
      type: AnomalyType.THRESHOLD_BREACH,
      context,
    });
  }

  private async evaluateVelocity(
    bankLine: BankLine,
    allocation: Allocation,
    context: DetectionContext,
  ): Promise<AnomalyAlert | null> {
    const { velocityCountLimit, velocityAmountLimit } = allocation;
    if (!velocityCountLimit && !velocityAmountLimit) {
      return null;
    }

    const windowDays = allocation.velocityWindowDays ?? 7;
    const windowStart = new Date(bankLine.date.getTime() - windowDays * MS_IN_DAY);

    const recentLines = await this.client.bankLine.findMany({
      where: {
        orgId: bankLine.orgId,
        payee: bankLine.payee,
        date: {
          gte: windowStart,
          lte: bankLine.date,
        },
      },
      orderBy: { date: "desc" },
    });

    if (recentLines.length === 0) {
      return null;
    }

    const reasons: Prisma.JsonObject[] = [];

    if (velocityCountLimit && recentLines.length > velocityCountLimit) {
      reasons.push({
        kind: "count",
        limit: velocityCountLimit,
        observed: recentLines.length,
      });
    }

    if (velocityAmountLimit) {
      const limit = new Decimal(velocityAmountLimit.toString());
      const observedTotal = recentLines.reduce(
        (acc, line) => acc.add(new Decimal(line.amount.toString())),
        new Decimal(0),
      );
      if (observedTotal.greaterThan(limit)) {
        reasons.push({
          kind: "amount",
          limit: limit.toString(),
          observed: observedTotal.toString(),
        });
      }
    }

    if (reasons.length === 0) {
      return null;
    }

    const existing = await this.client.anomalyAlert.findFirst({
      where: {
        allocationId: allocation.id,
        type: AnomalyType.VELOCITY_SPIKE,
        createdAt: {
          gte: windowStart,
        },
        status: {
          in: [AnomalyStatus.OPEN, AnomalyStatus.TRIAGED, AnomalyStatus.ESCALATED],
        },
      },
    });

    if (existing) {
      return null;
    }

    const metadata: Prisma.JsonObject = {
      allocationId: allocation.id,
      bankLineId: bankLine.id,
      payee: bankLine.payee,
      windowStart: windowStart.toISOString(),
      windowEnd: bankLine.date.toISOString(),
      velocityWindowDays: windowDays,
      reasons,
      sampleBankLineIds: recentLines.slice(0, 20).map((line) => line.id),
    };

    return this.createAlert({
      allocation,
      bankLine,
      message: `Velocity spike detected for ${bankLine.payee}`,
      metadata,
      severity: reasons.length > 1 ? AnomalySeverity.CRITICAL : AnomalySeverity.MEDIUM,
      type: AnomalyType.VELOCITY_SPIKE,
      context,
    });
  }

  private async createAlert(params: {
    bankLine: BankLine;
    allocation: Allocation;
    type: AnomalyType;
    severity: AnomalySeverity;
    message: string;
    metadata: Prisma.JsonObject;
    context: DetectionContext;
  }): Promise<AnomalyAlert> {
    const { bankLine, allocation, type, severity, message, metadata, context } = params;
    const actor = context.actor ?? "system/anomaly-detector";

    const alert = await this.client.$transaction(async (tx) => {
      const created = await tx.anomalyAlert.create({
        data: {
          orgId: bankLine.orgId,
          bankLineId: bankLine.id,
          allocationId: allocation.id,
          type,
          severity,
          message,
          metadata,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: bankLine.orgId,
          alertId: created.id,
          actor,
          action: AuditActionType.ANOMALY_CREATED,
          notes: message,
          context: metadata,
        },
      });

      return created;
    });

    return alert;
  }
}
