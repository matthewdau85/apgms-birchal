import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";
import { applyPolicy } from "../../../shared/policy-engine/index";
import { createLedgerEntry, storeLedgerEntry } from "./lib/ledger";
import { getRpt, mintRpt, verifyChain, verifyRpt } from "./lib/rpt";

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

const gateEnum = z.enum(["OPEN", "CLOSED"]);

const allocationRuleSchema = z.object({
  accountId: z.string().min(1),
  weight: z.number().positive().optional(),
  gate: gateEnum.optional(),
  label: z.string().optional(),
});

const accountStateSchema = z.object({
  accountId: z.string().min(1),
  gate: gateEnum.optional(),
});

const bankLineSchema = z.object({
  id: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().optional(),
});

const rulesetSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  rules: z.array(allocationRuleSchema).nonempty(),
});

const previewRequestSchema = z.object({
  bankLine: bankLineSchema,
  ruleset: rulesetSchema,
  accountStates: z.array(accountStateSchema),
});

const allocationSchema = z.object({
  accountId: z.string(),
  amount: z.number(),
  gate: gateEnum,
  weight: z.number(),
  reason: z.string(),
});

const previewResponseSchema = z.object({
  allocations: z.array(allocationSchema),
  policyHash: z.string(),
  explain: z.array(z.string()),
});

const applyRequestSchema = previewRequestSchema.extend({
  orgId: z.string().min(1),
  prevHash: z.string().min(1).optional(),
});

const ledgerEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  allocations: z.array(allocationSchema),
  createdAt: z.string(),
  rptHash: z.string(),
});

const rptTokenSchema = z.object({
  hash: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  allocations: z.array(z.object({ accountId: z.string(), amount: z.number() })),
  prevHash: z.string().nullable(),
  now: z.string(),
  signature: z.string(),
  publicKey: z.string(),
});

const applyResponseSchema = z.object({
  ledgerEntry: ledgerEntrySchema,
  rpt: rptTokenSchema,
});

app.post("/allocations/preview", async (req, rep) => {
  try {
    const parsed = previewRequestSchema.parse(req.body);
    const result = applyPolicy(parsed);
    const payload = previewResponseSchema.parse(result);
    return payload;
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "invalid_request" });
  }
});

app.post("/allocations/apply", async (req, rep) => {
  try {
    const parsed = applyRequestSchema.parse(req.body);
    const policyResult = applyPolicy(parsed);
    const ledgerEntry = createLedgerEntry({
      orgId: parsed.orgId,
      bankLineId: parsed.bankLine.id,
      policyHash: policyResult.policyHash,
      allocations: policyResult.allocations,
      rptHash: "",
    });

    const now = new Date().toISOString();
    const rpt = await mintRpt({
      orgId: parsed.orgId,
      bankLineId: parsed.bankLine.id,
      policyHash: policyResult.policyHash,
      allocations: policyResult.allocations.map((allocation) => ({
        accountId: allocation.accountId,
        amount: allocation.amount,
      })),
      prevHash: parsed.prevHash ?? ledgerEntry.rptHash || null,
      now,
    });

    const completedEntry = {
      ...ledgerEntry,
      rptHash: rpt.hash,
    };
    storeLedgerEntry(completedEntry);

    const payload = applyResponseSchema.parse({
      ledgerEntry: completedEntry,
      rpt,
    });

    return rep.code(201).send(payload);
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "invalid_request" });
  }
});

app.get("/audit/rpt/:id", async (req, rep) => {
  try {
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const token = getRpt(params.id);
    if (!token) {
      return rep.code(404).send({ error: "not_found" });
    }
    const [isValid, chainValid] = await Promise.all([verifyRpt(token), verifyChain(token.hash)]);
    if (!isValid || !chainValid) {
      return rep.code(409).send({ error: "verification_failed" });
    }
    const payload = rptTokenSchema.parse(token);
    return payload;
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "invalid_request" });
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

