import { defineConfig } from '@playwright/test';

const defaultBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: 'webapp/tests',
  timeout: 60_000,
  use: {
    baseURL: defaultBaseURL,
    actionTimeout: 0,
    navigationTimeout: 45_000,
  },
  reporter: process.env.CI
    ? [
        ['github'],
        ['list'],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['html', { open: 'never', outputFolder: 'playwright-report/html' }],
      ]
    : [['list']],
  outputDir: 'playwright-report/output',
});
