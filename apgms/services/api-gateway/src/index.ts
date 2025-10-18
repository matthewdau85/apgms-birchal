import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import {
  applyPolicy,
  PolicyEngineError,
  type AccountState,
  type BankLine,
  type PolicyRuleset,
} from "@apgms/policy-engine";
import { mintRPT, verifyStoredRPT } from "./lib/rpt";

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

type ApplyRequest = {
  bankLine: BankLine;
  ruleset: PolicyRuleset;
  accountStates: AccountState[];
  prevHash?: string | null;
};

app.post("/allocations/apply", async (req, rep) => {
  try {
    const body = req.body as ApplyRequest;
    const policyResult = applyPolicy({
      bankLine: body.bankLine,
      ruleset: body.ruleset,
      accountStates: body.accountStates,
    });

    const rpt = await mintRPT({
      bankLineId: body.bankLine.id,
      policyHash: policyResult.policyHash,
      allocations: policyResult.allocations,
      prevHash: body.prevHash ?? null,
    });

    return rep.code(201).send({
      allocationProposal: policyResult.allocations,
      policySnapshotHash: policyResult.policyHash,
      explanation: policyResult.explanation,
      rpt,
    });
  } catch (error) {
    req.log.error(error);
    if (error instanceof PolicyEngineError) {
      return rep.code(400).send({ error: "policy_error", message: error.message });
    }
    return rep.code(500).send({ error: "internal_error" });
  }
});

app.get("/audit/rpt/:id", async (req, rep) => {
  const { id } = req.params as { id: string };
  const verification = await verifyStoredRPT(id);

  if (!verification.ok) {
    if (verification.error === "not_found") {
      return rep.code(404).send({ error: "not_found" });
    }

    return rep.code(422).send({ error: verification.error, reason: verification.reason });
  }

  return { ok: true, verification };
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

