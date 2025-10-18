import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createRedisClient } from "./infra/redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const webhookSecret = process.env.WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("WEBHOOK_SECRET must be configured");
}

const redis = createRedisClient();

const app = await createApp({ redis, webhookSecret, logger: true });

app.addHook("onClose", async () => {
  await redis.quit();
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
