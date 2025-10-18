import { expect, test } from '@playwright/test';

import { analyzePage, initializeReport, writeReport } from './axe';

const baseURL = process.env.WEBAPP_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

function resolveUrl(pathname: string) {
  return new URL(pathname, baseURL).toString();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await initializeReport();
});

test.afterAll(async () => {
  await writeReport();
});

test('home page has no accessibility violations', async ({ page }) => {
  await page.goto(resolveUrl('/'));
  const results = await analyzePage(page);
  expect(results.violations).toHaveLength(0);
});

test('bank lines page has no accessibility violations', async ({ page }) => {
  await page.goto(resolveUrl('/bank-lines'));
  const results = await analyzePage(page);
  expect(results.violations).toHaveLength(0);
});
