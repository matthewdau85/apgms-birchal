import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "../services/api-gateway/src/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const app = await createApp();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

app
  .listen({ port, host })
  .then((address) => {
    app.log.info({ address }, "prod profile server ready");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
