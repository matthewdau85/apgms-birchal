import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

type JsonValue = Record<string, unknown> | string | number | boolean | null | JsonValue[];

import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";
import { PaymentEventType, PaymentStatus } from "@prisma/client";

const TAX_ENGINE_URL = process.env.TAX_ENGINE_URL ?? "http://localhost:8000";

async function callTaxEngine<T>(path: string, body: JsonValue): Promise<T> {
  const response = await fetch(`${TAX_ENGINE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`tax-engine error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function computeBasDraft(periodId: string) {
  const period = await prisma.taxPeriod.findUnique({
    where: { id: periodId },
    include: {
      org: true,
      supplies: true,
      purchases: true,
      adjustments: true,
      payEvents: true,
    },
  });

  if (!period) {
    throw new Error(`Period ${periodId} not found`);
  }

  const payload = {
    period: {
      id: period.id,
      label: period.label,
      abn: period.abn,
      dueDate: period.dueDate.toISOString(),
    },
    gst: {
      supplies: period.supplies.map((s) => ({
        date: s.supplyDate.toISOString().slice(0, 10),
        amount_cents: s.amountCents,
        gst_cents: s.gstCents,
        tax_code: s.taxCode,
      })),
      purchases: period.purchases.map((p) => ({
        date: p.purchaseDate.toISOString().slice(0, 10),
        amount_cents: p.amountCents,
        gst_cents: p.gstCents,
        tax_code: p.taxCode,
      })),
      adjustments: period.adjustments.map((a) => ({
        amount_cents: a.amountCents,
        gst_cents: a.gstCents,
        tax_code: a.taxCode,
      })),
    },
    paygw: {
      pay_events: period.payEvents.map((pe) => ({
        date: pe.payDate.toISOString().slice(0, 10),
        gross_cents: pe.grossCents,
        withheld_cents: pe.withheldCents,
        stsl_cents: pe.stslCents ?? 0,
      })),
    },
  };

  return callTaxEngine<{ gst: any; paygw: any; bas: any }>("/bas/compile", payload);
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/orgs", async () => {
    const orgs = await prisma.org.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        abn: true,
        accountingMethod: true,
        basCycle: true,
        createdAt: true,
      },
    });
    return { orgs };
  });

  app.get("/orgs/:orgId/dashboard", async (req, rep) => {
    const params = z.object({ orgId: z.string() }).parse(req.params);

    const org = await prisma.org.findUnique({
      where: { id: params.orgId },
      include: {
        financeAccounts: true,
      },
    });

    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }

    const currentPeriod = await prisma.taxPeriod.findFirst({
      where: { orgId: org.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });

    const reconMatches = await prisma.reconMatch.groupBy({
      by: ["status"],
      where: { orgId: org.id },
      _count: { _all: true },
    });

    const pendingPayments = await prisma.payment.findMany({
      where: {
        orgId: org.id,
        status: { in: [PaymentStatus.PENDING_CAPTURE, PaymentStatus.CREATED] },
      },
      orderBy: { initiatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        amountCents: true,
        reference: true,
        status: true,
        initiatedAt: true,
      },
    });

    const alerts = await prisma.auditEvent.findMany({
      where: { orgId: org.id, action: "anomaly_flag" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, entityId: true, createdAt: true, afterHash: true },
    });

    return {
      org: {
        id: org.id,
        name: org.name,
        abn: org.abn,
        accountingMethod: org.accountingMethod,
        basCycle: org.basCycle,
      },
      wallets: org.financeAccounts.map((acct) => ({
        id: acct.id,
        displayName: acct.displayName,
        type: acct.type,
        balanceCents: acct.balanceCents,
        oneWay: acct.oneWay,
      })),
      currentPeriod,
      reconciliation: reconMatches.map((entry) => ({
        status: entry.status,
        count: entry._count._all,
      })),
      pendingPayments,
      alerts,
    };
  });

  app.get("/periods/:periodId/bas", async (req, rep) => {
    const params = z.object({ periodId: z.string() }).parse(req.params);

    try {
      const result = await computeBasDraft(params.periodId);

      const period = await prisma.taxPeriod.findUnique({ where: { id: params.periodId } });
      if (period) {
        await prisma.$transaction(async (tx) => {
          await tx.gstBasCalc.upsert({
            where: { periodId: params.periodId },
            update: {
              g1: result.gst.g1,
              g2: result.gst.g2,
              g3: result.gst.g3,
              g10: result.gst.g10,
              g11: result.gst.g11,
              label1A: result.gst["1A"],
              label1B: result.gst["1B"],
              netPayable: result.bas.net_payable,
              source: result,
            },
            create: {
              orgId: period.orgId,
              periodId: params.periodId,
              g1: result.gst.g1,
              g2: result.gst.g2,
              g3: result.gst.g3,
              g10: result.gst.g10,
              g11: result.gst.g11,
              label1A: result.gst["1A"],
              label1B: result.gst["1B"],
              netPayable: result.bas.net_payable,
              source: result,
            },
          });

          await tx.paygwWithholdingCalc.upsert({
            where: { periodId: params.periodId },
            update: {
              w1: result.paygw.W1,
              w2: result.paygw.W2,
              source: result,
            },
            create: {
              orgId: period.orgId,
              periodId: params.periodId,
              w1: result.paygw.W1,
              w2: result.paygw.W2,
              source: result,
            },
          });
        });
      }

      return result;
    } catch (error) {
      req.log.error(error);
      return rep.code(500).send({ error: "bas_generation_failed" });
    }
  });

  app.post("/orgs/:orgId/payments/debit", async (req, rep) => {
    const params = z.object({ orgId: z.string() }).parse(req.params);
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return rep.code(400).send({ error: "missing_idempotency_key" });
    }

    const bodySchema = z.object({
      accountId: z.string(),
      amountCents: z.number().int().positive(),
      reference: z.string().min(3),
      description: z.string().optional(),
      periodId: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);

    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");

    const existingKey = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (existingKey) {
      if (existingKey.requestHash !== hash) {
        return rep.code(409).send({ error: "idempotency_conflict" });
      }
      return rep.send(existingKey.response ?? {});
    }

    const account = await prisma.financeAccount.findUnique({ where: { id: body.accountId } });
    if (!account || account.orgId !== params.orgId) {
      return rep.code(404).send({ error: "account_not_found" });
    }

    const period = body.periodId
      ? await prisma.taxPeriod.findUnique({ where: { id: body.periodId } })
      : null;

    const responsePayload = await prisma.$transaction(async (tx) => {
      await tx.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          scope: "payments:debit",
          requestHash: hash,
          orgId: params.orgId,
        },
      });

      const payment = await tx.payment.create({
        data: {
          orgId: params.orgId,
          accountId: account.id,
          periodId: period?.id,
          amountCents: body.amountCents,
          reference: body.reference,
          description: body.description,
          status: PaymentStatus.PENDING_CAPTURE,
        },
        select: {
          id: true,
          orgId: true,
          accountId: true,
          periodId: true,
          amountCents: true,
          status: true,
          reference: true,
          description: true,
          initiatedAt: true,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PaymentEventType.STATUS_CHANGED,
          detail: { status: PaymentStatus.PENDING_CAPTURE },
        },
      });

      return payment;
    });

    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { response: responsePayload },
    });

    return rep.code(201).send(responsePayload);
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  buildApp()
    .then((app) => app.listen({ port, host }))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
