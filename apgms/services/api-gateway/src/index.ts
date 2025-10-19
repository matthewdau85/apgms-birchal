import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { prisma } from "../../../shared/src/db";
import { buildApp, type AppDependencies } from "./app";
import { createShutdownHandler } from "./shutdown";

const dependencies: AppDependencies = { prisma };
const app = buildApp({}, dependencies);

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const shutdown = createShutdownHandler(app, dependencies);
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

try {
  await app.listen({ port, host });
  app.log.info({ port, host }, "api-gateway listening");
} catch (error) {
  app.log.error({ err: error }, "failed to start server");
  try {
    await prisma.$disconnect();
  } catch (disconnectError) {
    app.log.error({ err: disconnectError }, "failed to disconnect prisma during startup error");
  }
  process.exit(1);
}
