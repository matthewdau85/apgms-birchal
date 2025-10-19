import { createHash } from "node:crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/db";
import { allocate } from "@apgms/policy-engine";
import {
  previewRequestSchema,
  previewResponseSchema,
  applyRequestSchema,
  applyResponseSchema,
} from "../schemas/allocations.js";
import { mintRpt } from "../lib/rpt.js";

function toCents(amount: unknown): number {
  const numeric = Number(amount ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric * 100));
}

function defaultCurrency(): string {
  return process.env.DEFAULT_CURRENCY ?? "AUD";
}

export async function allocationsRoutes(app: FastifyInstance) {
  app.post("/allocations/preview", async (request, reply) => {
    const parsed = previewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", details: parsed.error.format() });
    }
    const { bankLineId, ruleset, accountStates } = parsed.data;
    const bankLine = await prisma.bankLine.findUnique({ where: { id: bankLineId } });
    if (!bankLine) {
      return reply.status(404).send({ error: "bank_line_not_found" });
    }
    const currency = defaultCurrency();
    const result = allocate({
      bankLine: {
        id: bankLine.id,
        orgId: bankLine.orgId,
        amountCents: toCents(bankLine.amount),
        currency,
      },
      ruleset,
      accountStates,
    });
    const response = previewResponseSchema.parse({
      allocations: result.allocations.map((allocation) => ({
        ...allocation,
        memo: allocation.memo ?? null,
      })),
      policyHash: result.policyHash,
      explain: result.explain,
    });
    return reply.send(response);
  });

  app.post("/allocations/apply", async (request, reply) => {
    const parsed = applyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", details: parsed.error.format() });
    }
    const { bankLineId, ruleset, accountStates, memo, keyAlias } = parsed.data;
    const bankLine = await prisma.bankLine.findUnique({ where: { id: bankLineId } });
    if (!bankLine) {
      return reply.status(404).send({ error: "bank_line_not_found" });
    }
    const currency = defaultCurrency();
    const result = allocate({
      bankLine: {
        id: bankLine.id,
        orgId: bankLine.orgId,
        amountCents: toCents(bankLine.amount),
        currency,
      },
      ruleset,
      accountStates,
    });
    const allocations = result.allocations.map((allocation) => ({
      ...allocation,
      memo: allocation.memo ?? memo ?? null,
    }));

    const prevRpt = await prisma.rptToken.findFirst({
      where: { orgId: bankLine.orgId },
      orderBy: { timestamp: "desc" },
    });
    const prevHash = prevRpt?.id ?? "GENESIS";
    const rpt = await mintRpt({
      orgId: bankLine.orgId,
      bankLineId: bankLine.id,
      policyHash: result.policyHash,
      allocations,
      prevHash,
      keyAlias,
    });

    const auditPayload = {
      orgId: bankLine.orgId,
      bankLineId: bankLine.id,
      allocations,
      explain: result.explain,
      rptId: rpt.id,
    };

    const transactionResult = await prisma.$transaction(async (tx) => {
      const ledgerEntries = await Promise.all(
        allocations.map((allocation) =>
          tx.ledgerEntry.create({
            data: {
              orgId: bankLine.orgId,
              bankLineId: bankLine.id,
              bucket: allocation.bucket,
              amountCents: allocation.amountCents,
              currency: allocation.currency,
              memo: allocation.memo,
            },
          })
        )
      );

      await tx.rptToken.create({
        data: {
          id: rpt.id,
          orgId: rpt.orgId,
          bankLineId: rpt.bankLineId,
          policyHash: rpt.policyHash,
          allocationsJson: rpt.allocations,
          prevHash: rpt.prevHash,
          sig: rpt.sig,
          timestamp: rpt.timestamp,
        },
      });

      const audit = await tx.auditBlob.create({
        data: {
          orgId: bankLine.orgId,
          kind: "allocation.apply",
          payloadJson: auditPayload,
          hash: createHash("sha256").update(JSON.stringify(auditPayload)).digest("hex"),
        },
      });

      return { ledgerEntries, audit };
    });

    const response = applyResponseSchema.parse({
      allocations,
      policyHash: result.policyHash,
      explain: result.explain,
      ledgerEntries: transactionResult.ledgerEntries.map((entry) => ({
        ...entry,
        memo: entry.memo ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      rpt: {
        ...rpt,
        timestamp: rpt.timestamp.toISOString(),
      },
      audit: {
        id: transactionResult.audit.id,
        kind: transactionResult.audit.kind,
        hash: transactionResult.audit.hash,
      },
    });

    return reply.status(201).send(response);
  });
}
