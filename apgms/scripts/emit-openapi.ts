import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Fastify from "fastify";

import openapiPlugin from "../services/api-gateway/src/plugins/openapi";

async function main() {
  const app = Fastify({ logger: false });

  await app.register(openapiPlugin);
  await app.ready();

  const document = app.swagger();

  const outputPath = path.resolve("docs/openapi.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(document, null, 2));

  await app.close();
}

main().catch((error) => {
  console.error("Failed to emit OpenAPI specification", error);
  process.exitCode = 1;
});
