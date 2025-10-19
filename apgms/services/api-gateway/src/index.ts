import dotenv from "dotenv";
import { buildApp, resolveEnvPath } from "./app";
import { scheduleSyncJobs } from "./jobs/sync";

dotenv.config({ path: resolveEnvPath() });

const app = buildApp({ logger: true });

app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const scheduler = scheduleSyncJobs();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  scheduler.stop();
  process.exit(1);
});

process.on("SIGINT", async () => {
  scheduler.stop();
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  scheduler.stop();
  await app.close();
  process.exit(0);
});
