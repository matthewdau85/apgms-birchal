import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/db";

type CheckResult = {
  allowedOrigins: Set<string>;
};

function buildCorsAllowlist(raw: string | undefined): CheckResult {
  const allowedOrigins = new Set<string>();
  if (raw) {
    for (const candidate of raw.split(",")) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        allowedOrigins.add(trimmed);
      }
    }
  }
  return { allowedOrigins };
}

export async function createApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    ...options,
    logger: options.logger ?? process.env.NODE_ENV !== "production",
  });

  const { allowedOrigins } = buildCorsAllowlist(process.env.CORS_ALLOWLIST);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.size === 0) {
        cb(null, false);
        return;
      }

      if (allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }

      cb(null, false);
    },
  });

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
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: "not_found" });
  });

  app.setErrorHandler((error, request, reply) => {
    const replyStatus = reply.statusCode >= 400 ? reply.statusCode : undefined;
    const statusCode =
      error.statusCode && error.statusCode >= 400
        ? error.statusCode
        : replyStatus && replyStatus >= 400
          ? replyStatus
          : 500;

    if (statusCode >= 500) {
      request.log.error(error);
      reply.status(statusCode).send({ error: "internal_server_error" });
      return;
    }

    const message = typeof error.message === "string" && error.message.length > 0 ? error.message : "error";
    reply.status(statusCode).send({ error: message });
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
