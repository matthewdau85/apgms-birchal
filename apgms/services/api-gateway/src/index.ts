import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { buildApp } from "./app.js";
import { buildOpenApiDocument } from "./openapi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

await app.ready();

const openApiDocument = buildOpenApiDocument();
const openApiPath = path.resolve(__dirname, "../openapi.json");
await writeFile(openApiPath, JSON.stringify(openApiDocument, null, 2), "utf8");
app.log.info({ openApiPath }, "openapi document generated");

await app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api-gateway listening");
  })
  .catch((err) => {
    app.log.error(err, "failed to start server");
    process.exit(1);
  });
