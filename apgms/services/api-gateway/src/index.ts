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
import {
  acknowledgeDiscrepancy,
  getDesignatedAccountBalances,
  getObligationSummaries,
  triggerBasSubmission,
} from "./compliance";

const acknowledgementParamsSchema = z.object({ obligationId: z.string().min(1) });
const acknowledgementBodySchema = z.object({
  acknowledgedBy: z.string().min(1),
  note: z.string().max(500).optional(),
});
const basSubmissionBodySchema = z.object({
  triggeredBy: z.string().min(1).default("system"),
});

export async function createApp() {
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

  app.get("/compliance/obligations", async () => ({ obligations: getObligationSummaries() }));

  app.get("/compliance/designated-account-balances", async () => ({
    accounts: getDesignatedAccountBalances(),
  }));

  app.post("/compliance/obligations/:obligationId/discrepancy/acknowledge", async (req, rep) => {
    try {
      const params = acknowledgementParamsSchema.parse(req.params);
      const body = acknowledgementBodySchema.parse(req.body ?? {});
      const result = acknowledgeDiscrepancy(params.obligationId, body);
      if (!result) {
        return rep.code(404).send({ error: "obligation_not_found" });
      }
      return { acknowledgement: result.acknowledgement, summary: result.summary };
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "invalid_acknowledgement" });
    }
  });

  app.post("/compliance/bas/submit", async (req, rep) => {
    try {
      const body = basSubmissionBodySchema.parse(req.body ?? {});
      const result = triggerBasSubmission(body.triggeredBy);
      if (!result.ok) {
        return rep.code(409).send({ error: "bas_not_ready", blockedObligations: result.blockedObligations });
      }
      return rep.code(202).send({ submission: result.submission });
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "invalid_request" });
    }
  });

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  await app.ready();

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";
  const app = await createApp();
  app
    .listen({ port, host })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
