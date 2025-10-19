import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export type PrismaClientLike = {
  user: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  bankLine: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
};

export interface BuildAppOptions {
  prismaClient?: PrismaClientLike;
  logger?: boolean;
  bodyLimit?: number;
  rateLimit?:
    | {
        max: number;
        timeWindow: string | number;
      }
    | false;
}

type RateLimitState = {
  count: number;
  resetAt: number;
};

function parseTimeWindow(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed.endsWith("ms")) {
    const ms = Number.parseInt(trimmed.slice(0, -2), 10);
    return Number.isFinite(ms) ? ms : 60000;
  }

  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) {
    return 60000;
  }

  if (trimmed.includes("second")) {
    return numeric * 1000;
  }

  if (trimmed.includes("minute") || trimmed.endsWith("m")) {
    return numeric * 60_000;
  }

  if (trimmed.includes("hour") || trimmed.endsWith("h")) {
    return numeric * 3_600_000;
  }

  return 60000;
}

let cachedPrisma: PrismaClientLike | null = null;

async function loadPrisma(): Promise<PrismaClientLike> {
  if (!cachedPrisma) {
    const module = await import("../../../shared/src/db");
    cachedPrisma = module.prisma as PrismaClientLike;
  }
  return cachedPrisma;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? 1024 * 1024,
  });

  await app.register(cors, { origin: true });

  if (options.rateLimit !== false) {
    const limitOptions = options.rateLimit ?? { max: 100, timeWindow: "1 minute" };
    const windowMs = parseTimeWindow(limitOptions.timeWindow);
    const hits = new Map<string, RateLimitState>();

    app.addHook("onRequest", async (req, reply) => {
      const key = (req.headers["x-forwarded-for"] as string | undefined) ?? req.ip ?? req.socket.remoteAddress ?? "anonymous";
      const now = Date.now();
      const record = hits.get(key);

      if (!record || record.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }

      if (record.count >= limitOptions.max) {
        await reply
          .code(429)
          .type("application/json")
          .send({ statusCode: 429, error: "Too Many Requests", message: "Rate limit exceeded" });
        return reply;
      }

      record.count += 1;
    });
  }

  const prismaClient = options.prismaClient ?? (await loadPrisma());

  app.get("/livez", async () => ({ status: "ok" }));

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prismaClient.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prismaClient.bankLine.findMany({
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

      const created = await prismaClient.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: Number(body.amount),
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

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
