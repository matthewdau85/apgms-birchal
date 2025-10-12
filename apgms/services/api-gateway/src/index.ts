import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const asDecimal = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  throw new Error("amount must be numeric");
};

const ensureString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (fallback.length) {
    return fallback;
  }
  throw new Error("required string missing");
};

const ensureDate = (value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  const parsed = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("invalid date");
  }
  return parsed;
};

const recordAuditEvent = async (
  kind: string,
  payload: Record<string, unknown>,
  actor = "system",
) => {
  const auditClient = (prisma as typeof prisma & {
    auditEvent?: { create: (input: unknown) => Promise<unknown> };
  }).auditEvent;

  if (!auditClient?.create) {
    app.log.warn({ kind }, "auditEvent model unavailable; skipping record");
    return;
  }

  try {
    await auditClient.create({
      data: { kind, actor, payload },
    });
  } catch (err) {
    app.log.error({ err, kind, payload }, "failed to record audit event");
  }
};

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/bank-lines", async (req) => {
  const query = req.query as { orgId?: string; take?: string };
  const where = query.orgId ? { orgId: query.orgId } : {};
  const take = query.take ? Math.min(Math.max(Number(query.take), 1), 200) : 50;

  const lines = await prisma.bankLine.findMany({
    where,
    orderBy: { date: "desc" },
    take,
  });

  return { lines };
});

app.get("/bank-lines/:id", async (req, reply) => {
  const params = req.params as { id: string };
  const line = await prisma.bankLine.findUnique({ where: { id: params.id } });
  if (!line) {
    reply.code(404);
    return { error: "not_found" };
  }
  return line;
});

app.post("/bank-lines", async (req, reply) => {
  try {
    const body = req.body as Record<string, unknown>;
    const created = await prisma.bankLine.create({
      data: {
        orgId: ensureString(body.orgId),
        amount: asDecimal(body.amount as number | string),
        date: ensureDate(body.date),
        payee: ensureString(body.payee, "unknown"),
        desc: ensureString(body.desc, "n/a"),
      },
    });

    await recordAuditEvent("BANKLINE_CREATE", { id: created.id });

    reply.code(201);
    return created;
  } catch (err) {
    req.log.error({ err }, "failed to create bank line");
    reply.code(400);
    return { error: "bad_request" };
  }
});

app.put("/bank-lines/:id", async (req, reply) => {
  const params = req.params as { id: string };
  try {
    const body = req.body as Record<string, unknown>;
    const updated = await prisma.bankLine.update({
      where: { id: params.id },
      data: {
        amount: body.amount !== undefined ? asDecimal(body.amount as number | string) : undefined,
        date: body.date ? ensureDate(body.date) : undefined,
        payee: body.payee !== undefined ? ensureString(body.payee, "unknown") : undefined,
        desc: body.desc !== undefined ? ensureString(body.desc, "") : undefined,
      },
    });

    await recordAuditEvent("BANKLINE_UPDATE", { id: updated.id });

    return updated;
  } catch (err) {
    req.log.error({ err }, "failed to update bank line");
    if ((err as { code?: string }).code === "P2025") {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.code(400);
    return { error: "bad_request" };
  }
});

app.delete("/bank-lines/:id", async (req, reply) => {
  const params = req.params as { id: string };
  try {
    const removed = await prisma.bankLine.delete({ where: { id: params.id } });
    await recordAuditEvent("BANKLINE_DELETE", { id: removed.id });
    return { ok: true };
  } catch (err) {
    req.log.error({ err }, "failed to delete bank line");
    if ((err as { code?: string }).code === "P2025") {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.code(400);
    return { error: "bad_request" };
  }
});

app.post("/reconcile/run", async (req, reply) => {
  try {
    const recClient = (prisma as typeof prisma & {
      reconciliationResult?: { create: (input: unknown) => Promise<{ id: string }> };
    }).reconciliationResult;

    if (!recClient?.create) {
      reply.code(501);
      return { ok: false, error: "reconciliation_unavailable" };
    }

    const count = await prisma.bankLine.count();
    const result = await recClient.create({
      data: {
        snapshotNote: `Reconciled ${count} bank lines`,
        status: "OK",
      },
    });

    await recordAuditEvent("RECONCILE_RUN", { id: result.id });

    return { ok: true, id: result.id };
  } catch (err) {
    req.log.error({ err }, "failed to run reconciliation");
    reply.code(500);
    return { error: "reconciliation_failed" };
  }
});

app.get("/tax/health", async (_req, reply) => {
  try {
    const base = process.env.TAX_ENGINE_URL ?? "http://tax-engine:8000";
    const response = await fetch(`${base}/health`);
    if (!response.ok) {
      throw new Error(`tax engine responded with ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    app.log.error({ err }, "tax engine health proxy failed");
    reply.code(502);
    return { ok: false, error: "tax-engine unavailable" };
  }
});

const start = async () => {
  try {
    await app.listen({ port, host });
    app.log.info(`api-gateway listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
