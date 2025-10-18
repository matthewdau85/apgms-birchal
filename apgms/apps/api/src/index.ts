import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import Fastify from "fastify";
import dotenv from "dotenv";
import {
  AnomalySeverity,
  AnomalyStatus,
  AuditActionType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@apgms/shared";
import { z } from "zod";

import { AnomalyDetector } from "./services/anomaly-detector";

class AlertNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Alert ${id} not found`);
  }
}

class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly id: string,
    public readonly from: AnomalyStatus,
    public readonly to: AnomalyStatus,
  ) {
    super(`Cannot transition alert ${id} from ${from} to ${to}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });
const detector = new AnomalyDetector(prisma);

const alertInclude = {
  bankLine: true,
  allocation: true,
  auditLogs: {
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.AnomalyAlertInclude;

app.register(cors, { origin: true });

const listBankLinesQuerySchema = z.object({
  orgId: z.string().optional(),
  take: z.coerce.number().min(1).max(200).optional(),
});

const createBankLineSchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.union([z.number(), z.string()]),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const listAlertsQuerySchema = z.object({
  orgId: z.string().optional(),
  status: z.nativeEnum(AnomalyStatus).optional(),
  take: z.coerce.number().min(1).max(200).optional(),
});

const alertParamsSchema = z.object({
  id: z.string().min(1),
});

const alertActionBodySchema = z.object({
  performedBy: z.string().min(1),
  notes: z.string().optional(),
});

app.get("/health", async () => ({ ok: true, service: "api" }));

app.get("/bank-lines", async (req) => {
  const query = listBankLinesQuerySchema.parse(req.query ?? {});
  const where: Prisma.BankLineWhereInput = {};
  if (query.orgId) {
    where.orgId = query.orgId;
  }

  const bankLines = await prisma.bankLine.findMany({
    where,
    orderBy: { date: "desc" },
    take: query.take ?? 50,
  });

  return { bankLines };
});

app.post("/bank-lines", async (req, rep) => {
  try {
    const body = createBankLineSchema.parse(req.body ?? {});
    const bankLine = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: body.date,
        amount: body.amount,
        payee: body.payee,
        desc: body.desc,
      },
    });

    const createdAlerts = await detector.evaluateBankLine(bankLine.id);
    const alerts = createdAlerts.length
      ? await prisma.anomalyAlert.findMany({
          where: { id: { in: createdAlerts.map((alert) => alert.id) } },
          include: alertInclude,
        })
      : [];

    return rep.code(201).send({ bankLine, alerts });
  } catch (err) {
    req.log.error({ err }, "failed to create bank line");
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.get("/alerts", async (req) => {
  const query = listAlertsQuerySchema.parse(req.query ?? {});
  const where: Prisma.AnomalyAlertWhereInput = {};
  if (query.orgId) {
    where.orgId = query.orgId;
  }
  if (query.status) {
    where.status = query.status;
  }

  const alerts = await prisma.anomalyAlert.findMany({
    where,
    include: alertInclude,
    orderBy: { createdAt: "desc" },
    take: query.take ?? 50,
  });

  return { alerts };
});

app.get("/alerts/:id", async (req, rep) => {
  const { id } = alertParamsSchema.parse(req.params ?? {});
  const alert = await prisma.anomalyAlert.findUnique({
    where: { id },
    include: alertInclude,
  });

  if (!alert) {
    return rep.code(404).send({ error: "alert_not_found" });
  }

  return { alert };
});

app.post("/alerts/:id/triage", async (req, rep) => {
  try {
    const { id } = alertParamsSchema.parse(req.params ?? {});
    const body = alertActionBodySchema.parse(req.body ?? {});

    const alert = await prisma.$transaction(async (tx) => {
      const current = await tx.anomalyAlert.findUnique({ where: { id } });
      if (!current) {
        throw new AlertNotFoundError(id);
      }

      if (current.status !== AnomalyStatus.OPEN) {
        throw new InvalidStatusTransitionError(id, current.status, AnomalyStatus.TRIAGED);
      }

      const updated = await tx.anomalyAlert.update({
        where: { id },
        data: {
          status: AnomalyStatus.TRIAGED,
          triagedAt: current.triagedAt ?? new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: updated.orgId,
          alertId: updated.id,
          actor: body.performedBy,
          action: AuditActionType.ANOMALY_TRIAGED,
          notes: body.notes,
          context: {
            previousStatus: current.status,
            nextStatus: AnomalyStatus.TRIAGED,
          },
        },
      });

      const full = await tx.anomalyAlert.findUnique({
        where: { id: updated.id },
        include: alertInclude,
      });

      if (!full) {
        throw new AlertNotFoundError(updated.id);
      }

      return full;
    });

    return { alert };
  } catch (err) {
    if (err instanceof AlertNotFoundError) {
      return rep.code(404).send({ error: "alert_not_found" });
    }
    if (err instanceof InvalidStatusTransitionError) {
      return rep.code(409).send({
        error: "invalid_status_transition",
        from: err.from,
        to: err.to,
      });
    }

    req.log.error({ err }, "failed to triage alert");
    return rep.code(500).send({ error: "internal_error" });
  }
});

app.post("/alerts/:id/escalate", async (req, rep) => {
  try {
    const { id } = alertParamsSchema.parse(req.params ?? {});
    const body = alertActionBodySchema.parse(req.body ?? {});

    const alert = await prisma.$transaction(async (tx) => {
      const current = await tx.anomalyAlert.findUnique({ where: { id } });
      if (!current) {
        throw new AlertNotFoundError(id);
      }

      if (current.status !== AnomalyStatus.OPEN && current.status !== AnomalyStatus.TRIAGED) {
        throw new InvalidStatusTransitionError(id, current.status, AnomalyStatus.ESCALATED);
      }

      const updated = await tx.anomalyAlert.update({
        where: { id },
        data: {
          status: AnomalyStatus.ESCALATED,
          escalatedAt: new Date(),
          severity:
            current.severity === AnomalySeverity.CRITICAL ? current.severity : AnomalySeverity.CRITICAL,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: updated.orgId,
          alertId: updated.id,
          actor: body.performedBy,
          action: AuditActionType.ANOMALY_ESCALATED,
          notes: body.notes,
          context: {
            previousStatus: current.status,
            nextStatus: AnomalyStatus.ESCALATED,
          },
        },
      });

      const full = await tx.anomalyAlert.findUnique({
        where: { id: updated.id },
        include: alertInclude,
      });

      if (!full) {
        throw new AlertNotFoundError(updated.id);
      }

      return full;
    });

    return { alert };
  } catch (err) {
    if (err instanceof AlertNotFoundError) {
      return rep.code(404).send({ error: "alert_not_found" });
    }
    if (err instanceof InvalidStatusTransitionError) {
      return rep.code(409).send({
        error: "invalid_status_transition",
        from: err.from,
        to: err.to,
      });
    }

    req.log.error({ err }, "failed to escalate alert");
    return rep.code(500).send({ error: "internal_error" });
  }
});

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
