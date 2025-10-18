import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

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

  app.get("/designated-accounts", async () => {
    const accounts = await prisma.designatedAccount.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { accounts };
  });

  app.get("/obligation-snapshots", async () => {
    const snapshots = await prisma.obligationSnapshot.findMany({
      orderBy: { effectiveDate: "desc" },
    });
    return { snapshots };
  });

  app.get("/settlement-instructions", async () => {
    const instructions = await prisma.settlementInstruction.findMany({
      orderBy: { dueDate: "asc" },
    });
    return { instructions };
  });

  app.get("/discrepancy-events", async () => {
    const discrepancies = await prisma.discrepancyEvent.findMany({
      orderBy: { detectedAt: "desc" },
    });
    return { discrepancies };
  });

  app.get("/compliance-documents", async () => {
    const documents = await prisma.complianceDocument.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return { documents };
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
