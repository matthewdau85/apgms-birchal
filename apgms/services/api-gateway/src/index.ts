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
import { allocationsRequestSchema } from "./lib/schemas/allocations";
import {
  deriveLedgerEntries,
  getStoredLedger,
  getStoredRpt,
  mintRpt,
  storeRptToken,
  verifyChain,
  verifyRpt,
} from "./lib/rpt";

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

app.post("/allocations/preview", async (req, rep) => {
  try {
    const body = allocationsRequestSchema.parse(req.body ?? {});
    const rpt = await mintRpt(body);
    const ledger = deriveLedgerEntries(rpt.payload, rpt.hash);
    return rep.send({ rpt, ledger });
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "invalid_request" });
  }
});

app.post("/allocations/apply", async (req, rep) => {
  try {
    const body = allocationsRequestSchema.parse(req.body ?? {});
    if (body.prevHash) {
      const prev = getStoredRpt(body.prevHash);
      if (!prev) {
        return rep.code(409).send({ error: "invalid_prev_hash" });
      }
    }

    const rpt = await mintRpt(body);
    const ledger = deriveLedgerEntries(rpt.payload, rpt.hash);
    storeRptToken(rpt, ledger);

    return rep.code(201).send({ id: rpt.hash });
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "invalid_request" });
  }
});

app.get("/audit/rpt/:id", async (req, rep) => {
  const { id } = req.params as { id: string };
  const rpt = getStoredRpt(id);

  if (!rpt) {
    return rep.code(404).send({ error: "not_found" });
  }

  const isValid = await verifyRpt(rpt);
  if (!isValid) {
    return rep.code(409).send({ error: "invalid_signature" });
  }

  const chainValid = await verifyChain(id);
  if (!chainValid) {
    return rep.code(409).send({ error: "invalid_chain" });
  }

  return rep.send({ rpt, ledger: getStoredLedger(id) ?? [] });
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

