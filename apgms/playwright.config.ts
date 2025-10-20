import { defineConfig } from "@playwright/test";

type HeaderRecord = Record<string, string> | undefined;

const baseURL = process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

function parseHeaders(): HeaderRecord {
  const raw = process.env.E2E_REQUIRED_HEADERS;
  if (!raw) {
    return undefined;
  }

  if (raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)])
      );
    } catch (error) {
      console.warn("Failed to parse JSON headers from E2E_REQUIRED_HEADERS", error);
    }
  }

  const pairs = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (pairs.length === 0) {
    return undefined;
  }

  const entries = pairs.map((pair) => {
    const [name, ...rest] = pair.split("=");
    return [name.trim(), rest.join("=").trim()];
  });

  return Object.fromEntries(entries);
}

const extraHTTPHeaders = parseHeaders();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    extraHTTPHeaders,
  },
});
