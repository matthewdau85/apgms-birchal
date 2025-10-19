import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import Fastify, { FastifyInstance } from "fastify";
import { z } from "zod";

import { AlertBus } from "./policy/alert-bus";
import { AuditLog } from "./policy/audit-log";
import { NoopAnomalyPipeline } from "./policy/anomaly-pipeline";
import { GateService } from "./policy/gate-service";
import { PolicyEngine } from "./policy/policy-engine";
import { RemittanceLedger } from "./policy/remittance-ledger";
import { ScheduledQueue } from "./policy/scheduled-queue";
import { AnomalyPipeline, Clock, GateReason, GateState } from "./policy/types";

export interface AppContext {
  gateService: GateService;
  ledger: RemittanceLedger;
  scheduledQueue: ScheduledQueue;
  anomalyPipeline: AnomalyPipeline;
  alertBus: AlertBus;
  auditLog: AuditLog;
  policyEngine: PolicyEngine;
  clock: Clock;
  prisma: PrismaClientLike;
}

export interface CreateAppOptions {
  logger?: boolean;
  clock?: Clock;
  dependencies?: Partial<
    Pick<
      AppContext,
      | "gateService"
      | "ledger"
      | "scheduledQueue"
      | "anomalyPipeline"
      | "alertBus"
      | "auditLog"
      | "policyEngine"
      | "prisma"
    >
  >;
}

export interface AppWithContext extends FastifyInstance {
  context: AppContext;
}

export interface PrismaClientLike {
  user: {
    findMany(...args: any[]): Promise<any[]>;
  };
  bankLine: {
    findMany(...args: any[]): Promise<any[]>;
    create(args: any): Promise<any>;
  };
}

const serializeGate = (gate: GateState) => ({
  ...gate,
  opensAt: gate.opensAt ?? null,
  updatedAt: gate.updatedAt,
});

const gateReasonSchema = z.string().transform((value) => value as GateReason);

export async function createApp(options: CreateAppOptions = {}): Promise<AppWithContext> {
  const clock: Clock = options.clock ?? (() => new Date());
  const deps = options.dependencies ?? {};

  const gateService = deps.gateService ?? new GateService(clock);
  const ledger = deps.ledger ?? new RemittanceLedger(clock);
  const scheduledQueue = deps.scheduledQueue ?? new ScheduledQueue(clock);
  const anomalyPipeline = deps.anomalyPipeline ?? new NoopAnomalyPipeline();
  const alertBus = deps.alertBus ?? new AlertBus(clock);
  const auditLog = deps.auditLog ?? new AuditLog(clock);
  const policyEngine =
    deps.policyEngine ??
    new PolicyEngine({
      gateService,
      ledger,
      scheduledQueue,
      anomalyPipeline,
      alertBus,
      auditLog,
      clock,
    });
  const prisma = deps.prisma;
  if (!prisma) {
    throw new Error("prisma dependency not provided to createApp");
  }

  const app = Fastify({ logger: options.logger ?? false }) as AppWithContext;
  app.context = {
    gateService,
    ledger,
    scheduledQueue,
    anomalyPipeline,
    alertBus,
    auditLog,
    policyEngine,
    clock,
    prisma,
  };

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (e) {
      req.log.error(e);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  const closeSchema = z
    .object({
      role: z.string(),
      reason: z.string().optional(),
      opensAt: z.string().datetime().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .strict();

  app.post("/gates/:id/close", async (req, rep) => {
    const parsed = closeSchema.parse(req.body ?? {});
    if (parsed.role !== "admin_compliance") {
      return rep.code(403).send({ error: "forbidden" });
    }
    const opensAt = parsed.opensAt ? new Date(parsed.opensAt) : null;
    const reason = parsed.reason
      ? gateReasonSchema.parse(parsed.reason)
      : ("MANUAL" as GateReason);
    const closed = gateService.close((req.params as any).id, {
      actorRole: parsed.role,
      reason,
      opensAt,
      requireAdminOverride: false,
    });
    auditLog.recordGateClosed({
      gateId: closed.id,
      actorRole: parsed.role,
      reason,
      opensAt: closed.opensAt ?? null,
      metadata: { source: "api", ...(parsed.metadata ?? {}) },
    });
    return rep.send({ gate: serializeGate(closed) });
  });

  const openSchema = z
    .object({
      role: z.string(),
      metadata: z.record(z.any()).optional(),
    })
    .strict();

  app.post("/gates/:id/open", async (req, rep) => {
    const parsed = openSchema.parse(req.body ?? {});
    if (parsed.role !== "admin_compliance") {
      return rep.code(403).send({ error: "forbidden" });
    }
    const opened = gateService.open((req.params as any).id, parsed.role);
    auditLog.recordGateOpened({
      gateId: opened.id,
      actorRole: parsed.role,
      metadata: { source: "api", ...(parsed.metadata ?? {}) },
    });
    return rep.send({ gate: serializeGate(opened) });
  });

  return app;
}

export const repoRootEnvPath = (() => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../../../.env");
})();
