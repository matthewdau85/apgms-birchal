import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

type PrismaLike = {
  user: {
    findMany: (...args: any[]) => Promise<any>;
  };
  bankLine: {
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
};

export interface BuildAppOptions {
  prisma?: PrismaLike;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  const allowCors = process.env.NODE_ENV !== "production";

  await app.register(cors, allowCors ? { origin: true } : { origin: false });

  app.log.info(
    {
      env: process.env.NODE_ENV,
      cors: allowCors ? "permissive" : "disabled",
    },
    "configured CORS profile"
  );

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  const { prisma } = options.prisma
    ? { prisma: options.prisma }
    : await import("../../../shared/src/db");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  if (process.env.NODE_ENV !== "production") {
    app.get("/debug/routes", async () => app.printRoutes());
  }

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as Record<string, unknown>).take ?? 20);
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
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      reply.status(statusCode).send({ error: "internal_server_error" });
      return;
    }

    reply.status(statusCode).send({
      error: error.name ?? "Error",
      message: error.message,
    });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
