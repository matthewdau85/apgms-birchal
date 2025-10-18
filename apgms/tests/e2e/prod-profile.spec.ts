import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../services/api-gateway/src/app";

async function main() {
  process.env.NODE_ENV = "production";
  process.env.CORS_ALLOWLIST = "https://app.example.com";

  const results: {
    success: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      details?: unknown;
      error?: string;
    }>;
  } = {
    success: true,
    checks: [],
  };

  const failures: string[] = [];

  async function runCheck<T>(name: string, fn: () => Promise<T>) {
    const record: {
      name: string;
      passed: boolean;
      details?: unknown;
      error?: string;
    } = {
      name,
      passed: false,
    };

    try {
      const details = await fn();
      record.passed = true;
      record.details = details;
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${record.error}`);
      results.success = false;
    } finally {
      results.checks.push(record);
    }
  }

  const app = await createApp({ logger: false });
  await app.ready();

  await runCheck("preflight-allowed", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/users",
      headers: {
        Origin: "https://app.example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    if (response.statusCode !== 204) {
      throw new Error(`expected 204, received ${response.statusCode}`);
    }

    return { status: response.statusCode };
  });

  await runCheck("preflight-blocked", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/users",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    if (response.statusCode === 204) {
      throw new Error("blocked origin should not receive 204");
    }
    if (response.statusCode < 400) {
      throw new Error(`expected failure status, received ${response.statusCode}`);
    }

    return { status: response.statusCode };
  });

  await runCheck("debug-route-404", async () => {
    const response = await app.inject({ method: "GET", url: "/__debug" });
    if (response.statusCode !== 404) {
      throw new Error(`expected 404 for /__debug, received ${response.statusCode}`);
    }
    return { status: response.statusCode };
  });

  await runCheck("unknown-route-404", async () => {
    const response = await app.inject({ method: "GET", url: "/definitely-not-a-real-route" });
    if (response.statusCode !== 404) {
      throw new Error(`expected 404 for unknown route, received ${response.statusCode}`);
    }
    return { status: response.statusCode };
  });

  await runCheck("sanitized-5xx", async () => {
    const response = await app.inject({ method: "GET", url: "/users" });
    if (response.statusCode !== 500) {
      throw new Error(`expected 500 for sanitized error, received ${response.statusCode}`);
    }
    const body = response.json();
    if (body.error !== "internal_server_error") {
      throw new Error(`expected internal_server_error token, received ${body.error}`);
    }
    const serialized = JSON.stringify(body);
    if (serialized.includes("stack") || serialized.includes("prisma") || serialized.includes("Error")) {
      throw new Error("sanitized error payload leaked sensitive information");
    }

    return { status: response.statusCode, body };
  });

  results.success = failures.length === 0;

  const reportDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../reports");
  const reportPath = path.resolve(reportDir, "prod-profile-check.json");

  try {
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2), "utf8");
  } finally {
    await app.close();
  }

  if (failures.length > 0) {
    console.error("Prod profile checks failed:\n" + failures.join("\n"));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
