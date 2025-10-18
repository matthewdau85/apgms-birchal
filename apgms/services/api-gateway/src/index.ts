import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const app = await createApp();

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
