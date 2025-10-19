import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { buildApp } from "./app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api-gateway listening");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
