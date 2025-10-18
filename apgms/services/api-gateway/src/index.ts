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
import { mintRpt } from "./lib/rpt";
import { putAuditBlob } from "./lib/audit";

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

app.post("/allocations/apply", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      amount: number | string;
      memo?: string;
    };

    let amountValue: string;
    if (typeof body.amount === "number") {
      amountValue = body.amount.toString();
    } else if (typeof body.amount === "string") {
      amountValue = body.amount;
    } else {
      throw new Error("invalid_amount");
    }

    const ledgerEntry = await prisma.ledgerEntry.create({
      data: {
        orgId: body.orgId,
        memo: body.memo ?? null,
        amount: amountValue,
      },
    });

    const rpt = mintRpt({
      orgId: body.orgId,
      ledgerEntryId: ledgerEntry.id,
      issuedAt: new Date().toISOString(),
    });

    await prisma.rptToken.create({
      data: {
        id: rpt.payload.tokenId,
        orgId: body.orgId,
        ledgerEntryId: ledgerEntry.id,
        payload: rpt.payload as any,
        signature: rpt.signature,
      },
    });

    const audit = await putAuditBlob({
      orgId: body.orgId,
      type: "rpt_token_issued",
      payload: { rpt },
    });

    return rep.code(201).send({
      ledgerEntry,
      rpt,
      audit,
    });
  } catch (err) {
    req.log.error(err);
    return rep.code(400).send({ error: "allocation_failed" });
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

