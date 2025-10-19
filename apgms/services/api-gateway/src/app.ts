import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { auditBlobStore } from "@apgms/shared/audit-blobs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

type PrismaClientLike = {
  user: { findMany: (args: unknown) => Promise<unknown[]> };
  bankLine: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
};

export interface BuildAppDependencies {
  prisma?: PrismaClientLike;
}

export async function buildApp(
  options: FastifyServerOptions = {},
  deps: BuildAppDependencies = {}
): Promise<FastifyInstance> {
  const prisma =
    deps.prisma ?? (await import("@apgms/shared/db")).prisma;

  const app = Fastify({ logger: true, ...options });

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
    const take = Number((req.query as Record<string, string | undefined>).take ?? 20);
    const safeTake = Math.min(Math.max(Number.isFinite(take) ? take : 20, 1), 200);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: safeTake,
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

  app.get("/alerts", async (req) => {
    const query = req.query as Record<string, string | undefined>;
    const page = Math.max(parseInt(query.page ?? "1", 10) || 1, 1);
    const pageSizeRaw = parseInt(query.pageSize ?? "20", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw || 20, 1), 200);
    return auditBlobStore.listAlerts({ page, pageSize });
  });

  return app;
}
