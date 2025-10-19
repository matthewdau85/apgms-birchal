const path = require("node:path");
const fs = require("node:fs/promises");
const { register } = require("tsx/cjs/api");

(async () => {
  const unregister = register({
    tsconfig: path.resolve(__dirname, "../services/api-gateway/tsconfig.json"),
  });

  try {
    const { buildApp } = require("../services/api-gateway/src/app.ts");
    const app = await buildApp();

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });

      const address = app.server.address();
      if (!address || typeof address !== "object") {
        throw new Error("Failed to determine server address");
      }

      const specUrl = `http://127.0.0.1:${address.port}/openapi.json`;
      const response = await fetch(specUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
      }

      const spec = await response.json();
      const outputPath = path.resolve(__dirname, "../openapi.json");
      await fs.writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf-8");
    } finally {
      await app.close();
    }
  } finally {
    await unregister();
  }
})();
