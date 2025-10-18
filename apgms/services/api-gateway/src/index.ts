import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import {
  AnomalyEngine,
  DetectionContext,
  TransactionSample,
  prisma,
} from "../../../shared/src";

const engine = new AnomalyEngine();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
      category?: string | null;
    };
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
        category: body.category ?? null,
      },
    });
    return rep.code(201).send(created);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

const toSample = (line: { id: string; orgId: string; date: Date; amount: Prisma.Decimal; payee: string; desc: string; category: string | null; }): TransactionSample => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date,
  amount: line.amount.toNumber(),
  payee: line.payee,
  desc: line.desc,
  category: line.category,
});

const serializeCounterExamples = (
  counterExamples: { transaction: TransactionSample; reason: string }[]
) =>
  counterExamples.map((example) => ({
    reason: example.reason,
    transaction: {
      ...example.transaction,
      date: example.transaction.date.toISOString(),
    },
  }));

app.get("/alerts", async (req) => {
  const query = req.query as {
    status?: string;
    ruleId?: string;
    orgId?: string;
    severity?: string;
  };
  const where: Prisma.AlertWhereInput = {};
  if (query.status) {
    where.status = query.status as any;
  }
  if (query.ruleId) {
    where.ruleId = query.ruleId;
  }
  if (query.orgId) {
    where.orgId = query.orgId;
  }
  if (query.severity) {
    where.severity = query.severity as any;
  }
  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { detectedAt: "desc" },
  });
  return { alerts };
});

app.post("/alerts", async (req, rep) => {
  try {
    const body = req.body as {
      transaction: {
        id?: string;
        orgId: string;
        date: string;
        amount: number;
        payee: string;
        desc: string;
        category?: string | null;
      };
      policy?: DetectionContext["policy"];
    };

    const txnDate = new Date(body.transaction.date);
    const history = await prisma.bankLine.findMany({
      where: {
        orgId: body.transaction.orgId,
        date: { lt: txnDate },
      },
      orderBy: { date: "desc" },
      take: 365,
    });

    const findings = engine.evaluate(
      {
        id: body.transaction.id ?? `txn-${Date.now()}`,
        orgId: body.transaction.orgId,
        date: txnDate,
        amount: body.transaction.amount,
        payee: body.transaction.payee,
        desc: body.transaction.desc,
        category: body.transaction.category ?? null,
      },
      history.map(toSample),
      { policy: body.policy }
    );

    const createdAlerts = await Promise.all(
      findings.map((finding) =>
        prisma.alert.create({
          data: {
            orgId: body.transaction.orgId,
            ruleId: finding.ruleId,
            severity: finding.severity,
            summary: finding.summary,
            transactionRef: body.transaction.id ?? null,
            context: finding.context,
            counterExample: serializeCounterExamples(finding.counterExamples),
          },
        })
      )
    );

    if (createdAlerts.length === 0) {
      return rep.code(204).send();
    }

    return rep.code(201).send({ alerts: createdAlerts });
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.post("/alerts/:id/ack", async (req, rep) => {
  try {
    const updated = await prisma.alert.update({
      where: { id: (req.params as { id: string }).id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
      },
    });
    return updated;
  } catch (error) {
    req.log.error(error);
    return rep.code(404).send({ error: "not_found" });
  }
});

app.post("/alerts/:id/escalate", async (req, rep) => {
  try {
    const updated = await prisma.alert.update({
      where: { id: (req.params as { id: string }).id },
      data: {
        status: "ESCALATED",
        escalatedAt: new Date(),
      },
    });
    return updated;
  } catch (error) {
    req.log.error(error);
    return rep.code(404).send({ error: "not_found" });
  }
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

