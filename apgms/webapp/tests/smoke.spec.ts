import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const dashboardResponse = {
  kpis: [
    { label: 'Total Volume', value: 125000, change: 3.2 },
    { label: 'New Clients', value: 28, change: 1.5 },
    { label: 'Approvals', value: 92, change: -0.6 },
    { label: 'Pending Reviews', value: 14 }
  ],
  chart: Array.from({ length: 10 }).map((_, index) => ({
    date: `2024-07-${String(index + 1).padStart(2, '0')}`,
    value: 100000 + index * 2500
  }))
};

const bankLinesResponse = {
  data: [
    {
      id: 'line-1',
      date: '2024-07-15T12:00:00Z',
      payee: 'Acme Corp',
      amount: 4500.78,
      currency: 'USD',
      rptId: 'rpt-1'
    }
  ],
  meta: {
    page: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 1
  }
};

const rptResponse = {
  id: 'rpt-1',
  status: 'Verified',
  lastVerifiedAt: '2024-07-15T18:30:00Z'
};

test('dashboard to bank lines flow', async ({ page }) => {
  await page.route('**/dashboard', (route) => route.fulfill({ json: dashboardResponse }));
  await page.route('**/bank-lines?**', (route) => route.fulfill({ json: bankLinesResponse }));
  await page.route('**/audit/rpt/by-line/line-1', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: rptResponse });
    }

    return route.fulfill({ json: rptResponse });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total Volume')).toBeVisible();
  await expect(page.getByText(/125[\s,]?000/)).toBeVisible();

  await expectPageAccessible(page);

  await page.getByRole('link', { name: 'Bank Lines' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bank Lines' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Acme Corp/ })).toBeVisible();

  await page.getByRole('row', { name: /Acme Corp/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Status: Verified/)).toBeVisible();

  await expect(dialog.getByRole('button', { name: 'Verify' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Verify' }).click();
  await expect(dialog.getByText('Verification completed.')).toBeVisible();

  await expectPageAccessible(page);
});

async function expectPageAccessible(page: Page) {
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    return await (window as any).axe.run();
  });
  expect(results.violations).toEqual([]);
}
