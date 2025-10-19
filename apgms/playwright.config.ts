import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm --filter @apgms/webapp dev',
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
});
