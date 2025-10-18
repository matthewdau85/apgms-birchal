import assert from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildApp } from "../src/app";

interface CheckResult {
  pass: boolean;
  detail: string;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  process.env.NODE_ENV = "production";
  process.env.PORT = "0";

  const results: Record<string, CheckResult> = {
    cors: { pass: false, detail: "not run" },
    debugRoute: { pass: false, detail: "not run" },
    sanitizedErrors: { pass: false, detail: "not run" },
  };

  const stubPrisma = {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({}),
    },
  };

  const app = await buildApp({ prisma: stubPrisma });

  const serverAddress = await app.listen({ port: 0, host: "127.0.0.1" });
  const addressInfo = app.server.address() as AddressInfo | null;
  if (!addressInfo) {
    throw new Error(`failed to determine listening port from ${serverAddress}`);
  }
  const baseUrl = `http://127.0.0.1:${addressInfo.port}`;

  try {
    // Tight CORS: foreign preflight must not be accepted.
    try {
      const preflight = await fetchWithTimeout(`${baseUrl}/users`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "GET",
        },
      });
      const allowed =
        preflight.status >= 200 &&
        preflight.status < 300 &&
        preflight.headers.has("access-control-allow-origin");
      assert.ok(!allowed, `expected preflight to be blocked, got ${preflight.status}`);
      results.cors = {
        pass: true,
        detail: `blocked with status ${preflight.status}`,
      };
    } catch (error) {
      results.cors = {
        pass: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    // Debug route should not exist in production.
    try {
      const response = await fetchWithTimeout(`${baseUrl}/debug/routes`);
      assert.strictEqual(response.status, 404, "expected 404 for debug route");
      results.debugRoute = {
        pass: true,
        detail: "debug route unavailable in production",
      };
    } catch (error) {
      results.debugRoute = {
        pass: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    // 5xx responses must not leak stack traces.
    try {
      stubPrisma.user.findMany = async () => {
        throw new Error("forced failure");
      };
      const failingResponse = await fetchWithTimeout(`${baseUrl}/users`);
      const bodyText = await failingResponse.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(bodyText) as Record<string, unknown>;
      } catch (error) {
        throw new Error(`expected JSON body, received: ${bodyText}`);
      }
      assert.strictEqual(failingResponse.status, 500, "expected 500 status for forced failure");
      assert.ok(!("stack" in parsed), "stack trace leaked in response body");
      results.sanitizedErrors = {
        pass: true,
        detail: "internal errors redacted",
      };
    } catch (error) {
      results.sanitizedErrors = {
        pass: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    await app.close();
  }

  const reportDir = resolve(dirname(fileURLToPath(import.meta.url)), "../reports");
  await mkdir(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, "prod-profile-check.json");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results,
      },
      null,
      2
    )
  );

  const success = Object.values(results).every((check) => check.pass);
  if (!success) {
    console.error("Prod profile checks failed", results);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
