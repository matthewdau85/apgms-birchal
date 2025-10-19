import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";

import { prisma, bankLineCreateSchema, paginationSchema } from "@apgms/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

type BuildOptions = FastifyServerOptions & { skipLogging?: boolean };

export async function buildApp(options: BuildOptions = {}) {
  const { skipLogging, ...fastifyOptions } = options;
  const app = Fastify({
    logger: skipLogging ? false : { level: process.env.LOG_LEVEL ?? "info" },
    ...fastifyOptions,
  });

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
    const query = paginationSchema.safeParse(req.query ?? {});
    const take = query.success ? query.data.take : 20;
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    const parsed = bankLineCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, "invalid bank line payload");
      return rep.code(400).send({ error: "bad_request", issues: parsed.error.issues });
    }

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: parsed.data.orgId,
          date: parsed.data.date,
          amount: parsed.data.amount,
          payee: parsed.data.payee,
          desc: parsed.data.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (error) {
      req.log.error(error, "failed to create bank line");
      return rep.code(500).send({ error: "internal_error" });
    }
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect().catch((error) => {
      app.log.error(error, "failed to disconnect prisma");
    });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
