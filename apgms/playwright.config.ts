import { defineConfig } from "@playwright/test";

const baseURL = process.env.APGMS_E2E_BASE_URL ?? "http://127.0.0.1:3000";

const defaultHeaders: Record<string, string> = {
  accept: "application/json",
  "x-apgms-e2e": "playwright-smoke",
};

function loadRequiredHeaders(): Record<string, string> {
  const raw = process.env.APGMS_E2E_REQUIRED_HEADERS;
  if (!raw) {
    return defaultHeaders;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)])
    );
    return { ...defaultHeaders, ...normalized };
  } catch (error) {
    console.warn(
      "Failed to parse APGMS_E2E_REQUIRED_HEADERS; falling back to defaults",
      error
    );
    return defaultHeaders;
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    extraHTTPHeaders: loadRequiredHeaders(),
  },
});
