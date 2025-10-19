import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/src/db";
import bankLinesRoutes from "./routes/v1/bank-lines";

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.decorateRequest("org", null);

  app.addHook("preHandler", async (request, reply) => {
    const orgIdHeader = request.headers["x-org-id"];
    if (typeof orgIdHeader !== "string" || !orgIdHeader.trim()) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    request.org = { id: orgIdHeader };
  });

  await app.register(bankLinesRoutes);

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
