import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { buildApp } from "./app.js";
import { prisma } from "@apgms/shared/db";

const app = await buildApp({ logger: true });

app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch(async (err) => {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
