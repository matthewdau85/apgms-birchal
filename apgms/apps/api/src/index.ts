import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../shared/src/db";
import {
  AllocationBreakdown,
  AllocationProposal,
  asBankLineInput,
  evaluateRuleSet,
  resolveRuleSetForOrg,
  allocationsEqual,
} from "./services/policy-engine";
import { getDefaultRptService } from "./services/rpt";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api" }));

const bankLineParamsSchema = z.object({ id: z.string().min(1) });
const classificationQuerySchema = z.object({
  minConfidence: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value == null ? undefined : Number(value)))
    .refine((value) => value === undefined || (!Number.isNaN(value) && value >= 0 && value <= 1), {
      message: "minConfidence must be between 0 and 1",
    }),
});

const applyBodySchema = z.object({
  policyHash: z.string().min(1),
  allocation: z
    .array(
      z.object({
        accountId: z.string().min(1),
        amount: z.number(),
        ratio: z.number().optional(),
        memo: z.string().optional(),
      }),
    )
    .min(1),
});

app.post("/bank-lines/:id/classification", async (request, reply) => {
  const params = bankLineParamsSchema.parse(request.params);
  const query = classificationQuerySchema.parse(request.query ?? {});

  const bankLine = await prisma.bankLine.findUnique({
    where: { id: params.id },
  });

  if (!bankLine) {
    return reply.code(404).send({ error: "bank_line_not_found" });
  }

  const ruleSet = resolveRuleSetForOrg(bankLine.orgId);
  const evaluation = evaluateRuleSet(asBankLineInput(bankLine), ruleSet, {
    minimumConfidence: query.minConfidence,
  });

  const payload = {
    bankLineId: evaluation.bankLineId,
    ruleSet: {
      id: evaluation.ruleSetId,
      version: evaluation.ruleSetVersion,
    },
    proposals: evaluation.proposals.map(serializeProposal),
    evaluatedAt: evaluation.evaluatedAt,
  };

  return reply.send(payload);
});

app.post("/bank-lines/:id/allocations/apply", async (request, reply) => {
  const params = bankLineParamsSchema.parse(request.params);
  const body = applyBodySchema.parse(request.body);

  const bankLine = await prisma.bankLine.findUnique({ where: { id: params.id } });
  if (!bankLine) {
    return reply.code(404).send({ error: "bank_line_not_found" });
  }

  const ruleSet = resolveRuleSetForOrg(bankLine.orgId);
  const evaluation = evaluateRuleSet(asBankLineInput(bankLine), ruleSet);
  const selectedProposal = evaluation.proposals.find((proposal) => proposal.policyHash === body.policyHash);

  if (!selectedProposal) {
    return reply.code(422).send({ error: "policy_hash_not_recognised" });
  }

  if (!allocationsEqual(selectedProposal.allocation, body.allocation as AllocationBreakdown[])) {
    return reply.code(422).send({ error: "allocation_mismatch" });
  }

  const rptService = getDefaultRptService();

  const result = await prisma.$transaction(async (tx) => {
    const prevToken = await tx.rptToken.findFirst({
      select: { hash: true },
      orderBy: { createdAt: "desc" },
    });

    const metadata = {
      ruleId: selectedProposal.ruleId,
      ruleName: selectedProposal.ruleName,
      confidence: selectedProposal.confidence,
      matchedConditions: selectedProposal.matchedConditions,
      ruleSetId: evaluation.ruleSetId,
      ruleSetVersion: evaluation.ruleSetVersion,
      evaluatedAt: evaluation.evaluatedAt,
    } as Prisma.JsonValue;

    const allocationJson = body.allocation as unknown as Prisma.JsonValue;

    const ledgerEntry = await tx.ledgerEntry.upsert({
      where: { bankLineId: bankLine.id },
      create: {
        bankLineId: bankLine.id,
        orgId: bankLine.orgId,
        policyHash: selectedProposal.policyHash,
        allocation: allocationJson,
        metadata,
      },
      update: {
        policyHash: selectedProposal.policyHash,
        allocation: allocationJson,
        metadata,
      },
    });

    const rptToken = rptService.createToken({
      bankLineId: bankLine.id,
      policyHash: selectedProposal.policyHash,
      allocation: body.allocation,
      prevHash: prevToken?.hash ?? null,
    });

    if (!rptService.verifyToken(rptToken)) {
      throw new Error("Failed to verify generated RPT token");
    }

    const issuedAt = new Date(rptToken.payload.timestamp);

    const persistedRpt = await tx.rptToken.create({
      data: {
        ledgerEntryId: ledgerEntry.id,
        bankLineId: bankLine.id,
        policyHash: selectedProposal.policyHash,
        allocation: allocationJson,
        payload: rptToken.payload as unknown as Prisma.JsonValue,
        payloadHash: rptToken.payloadHash,
        hash: rptToken.hash,
        prevHash: rptToken.prevHash,
        signature: rptToken.signature,
        algorithm: rptToken.algorithm,
        publicKey: rptToken.publicKey,
        timestamp: issuedAt,
      },
    });

    return { ledgerEntry, rpt: persistedRpt, issued: rptToken };
  });

  return reply.code(201).send({
    ledgerEntry: sanitizeLedgerEntry(result.ledgerEntry),
    rptToken: sanitizeRptToken(result.rpt, result.issued),
  });
});

function serializeProposal(proposal: AllocationProposal) {
  return {
    ruleId: proposal.ruleId,
    ruleName: proposal.ruleName,
    policyHash: proposal.policyHash,
    allocation: proposal.allocation,
    totalAmount: proposal.totalAmount,
    confidence: proposal.confidence,
    metadata: proposal.metadata,
    matchedConditions: proposal.matchedConditions,
  };
}

function sanitizeLedgerEntry(entry: {
  id: string;
  bankLineId: string;
  orgId: string;
  policyHash: string;
  allocation: Prisma.JsonValue;
  status: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    bankLineId: entry.bankLineId,
    orgId: entry.orgId,
    policyHash: entry.policyHash,
    allocation: entry.allocation,
    status: entry.status,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

function sanitizeRptToken(
  stored: {
    id: string;
    ledgerEntryId: string;
    bankLineId: string;
    policyHash: string;
    allocation: Prisma.JsonValue;
    payload: Prisma.JsonValue;
    payloadHash: string;
    hash: string;
    prevHash: string | null;
    signature: string;
    algorithm: string;
    publicKey: string;
    timestamp: Date;
    createdAt: Date;
  },
  issued: { payload: { timestamp: string } },
) {
  return {
    id: stored.id,
    ledgerEntryId: stored.ledgerEntryId,
    bankLineId: stored.bankLineId,
    policyHash: stored.policyHash,
    allocation: stored.allocation,
    payload: stored.payload,
    payloadHash: stored.payloadHash,
    hash: stored.hash,
    prevHash: stored.prevHash,
    signature: stored.signature,
    algorithm: stored.algorithm,
    publicKey: stored.publicKey,
    timestamp: issued.payload.timestamp,
    createdAt: stored.createdAt.toISOString(),
  };
}

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
