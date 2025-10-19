import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import dotenv from "dotenv";
import { buildApp } from "../services/api-gateway/src/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  process.env.PRISMA_DISABLED = process.env.PRISMA_DISABLED ?? "true";

  const app = await buildApp({ logger: false });
  await app.ready();

  const address = await app.listen({ port: 0, host: "127.0.0.1" });

  let baseUrl: string;
  if (typeof address === "string") {
    baseUrl = address;
  } else {
    const info = address as AddressInfo;
    baseUrl = `http://${info.address}:${info.port}`;
  }

  try {
    const response = await fetch(`${baseUrl}/openapi.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI document: ${response.status}`);
    }
    const spec = await response.json();
    const outputPath = path.resolve(__dirname, "../openapi.json");
    await writeFile(outputPath, JSON.stringify(spec, null, 2));
    console.log(`OpenAPI spec written to ${outputPath}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
