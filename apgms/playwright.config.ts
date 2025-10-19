import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.API_BASE_URL ?? "http://127.0.0.1:4010",
    extraHTTPHeaders: {
      "content-type": "application/json",
    },
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
});
