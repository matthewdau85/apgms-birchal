import { defineConfig } from "@playwright/test";
import path from "node:path";

const webappDir = path.resolve(__dirname, "webapp");

export default defineConfig({
  testDir: "tests/webapp",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: "pnpm --dir webapp dev --host 0.0.0.0 --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    cwd: webappDir,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
});
