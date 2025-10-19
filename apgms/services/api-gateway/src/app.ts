import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { prisma } from "@apgms/shared";
import openapiPlugin, {
  createOpenApiSpec,
  updateSpecFromRoute,
} from "./plugins/openapi";
import reportsRoutes from "./routes/v1/reports";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export async function buildApp() {
  const app = Fastify({ logger: true });

  const openapiSpec = createOpenApiSpec();

  await app.register(cors, { origin: true });
  app.addHook("onRoute", (routeOptions) => {
    updateSpecFromRoute(openapiSpec, routeOptions);
  });
  await app.register(openapiPlugin, { spec: openapiSpec });
  await app.register(reportsRoutes);

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

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
