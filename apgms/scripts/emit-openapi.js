#!/usr/bin/env node
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function resolveEntry() {
  const baseDir = path.resolve("services/api-gateway/dist");
  const candidates = [
    path.join(baseDir, "index.js"),
    path.join(baseDir, "services/api-gateway/src/index.js"),
  ];

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate compiled API entry in ${baseDir}`);
}

async function main() {
  const distEntry = await resolveEntry();
  const outPath = path.resolve("openapi.json");

  const { buildApp } = await import(pathToFileURL(distEntry).href);
  const app = await buildApp();
  await app.ready();

  const document = app.swagger();
  await fs.writeFile(outPath, JSON.stringify(document, null, 2));
  await app.close();

  console.log(`OpenAPI specification written to ${path.relative(process.cwd(), outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
