import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: resolve(__dirname, "tests/e2e"),
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  use: {
    trace: "on-first-retry",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], headless: true }
    }
  ]
});
