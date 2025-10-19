import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../../shared/src/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

if (process.env.OTEL_ENABLED === "true") {
  const { startOtel } = await import("./observability/otel.ts");
  await startOtel();
}

const [{ default: Fastify }, { default: cors }] = await Promise.all([
  import("fastify"),
  import("@fastify/cors"),
]);

export const createApp = async (): Promise<FastifyInstance> => {
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

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

export const startServer = async (): Promise<FastifyInstance> => {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";
  await app.listen({ port, host });
  return app;
};

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMain) {
  try {
    await startServer();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
