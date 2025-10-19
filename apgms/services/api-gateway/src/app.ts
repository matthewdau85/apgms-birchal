import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { allocationsRoutes } from "./routes/allocations.js";
import { adminKeyRoutes } from "./routes/admin/keys.js";
import { auditRoutes } from "./routes/audit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

declare module "fastify" {
  interface FastifyInstance {
    buildTime?: Date;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  app.buildTime = new Date();
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  await allocationsRoutes(app);
  await adminKeyRoutes(app);
  await auditRoutes(app);

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
