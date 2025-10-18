import { defineConfig } from '@playwright/test';

const DEFAULT_PORT = Number(process.env.WEBAPP_PORT ?? 4173);
const fallbackBaseUrl = `http://localhost:${DEFAULT_PORT}`;

export default defineConfig({
  testDir: './webapp/tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? fallbackBaseUrl,
    trace: 'on-first-retry'
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec http-server webapp -p ${DEFAULT_PORT} -c-1 --silent`,
        url: fallbackBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
      }
});
