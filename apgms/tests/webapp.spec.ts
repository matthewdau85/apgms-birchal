import { test, expect, Page } from '@playwright/test';
import axe from 'axe-core';

async function expectPageToBeAccessible(page: Page) {
  const hasAxe = await page.evaluate(() => Boolean((window as typeof window & { axe?: unknown }).axe));
  if (!hasAxe) {
    await page.addScriptTag({ content: axe.source });
  }

  const results = await page.evaluate(async () => {
    return await (window as typeof window & { axe: typeof axe }).axe.run(document, {
      reporter: 'v2',
      resultTypes: ['violations']
    });
  });

  expect(results.violations, results.violations.map((violation) => violation.id).join(', ')).toEqual([]);
}

test.describe('APGMS Webapp', () => {
  test('dashboard and bank lines flow with zero axe violations', async ({ page }) => {
    const dashboardResponse = {
      kpis: [
        { id: 'net-cash', label: 'Net Cash', value: 12450000, change: 3.4, currency: 'USD' },
        { id: 'settled', label: 'Settled', value: 8450000, change: -1.2, currency: 'USD' },
        { id: 'pending', label: 'Pending', value: 2560000, change: 0.9, currency: 'USD' },
        { id: 'new-accounts', label: 'New Accounts', value: 142000, change: 4.1, currency: 'USD' }
      ],
      chart: Array.from({ length: 30 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - index));
        return {
          date: date.toISOString(),
          inflow: 500000 + index * 5000,
          outflow: 320000 + index * 4000
        };
      })
    };

    const pageSize = 8;
    const bankLinePages = {
      1: {
        items: Array.from({ length: pageSize }).map((_, index) => ({
          id: `line-${index + 1}`,
          name: `Citi International ${index + 1}`,
          utilization: 0.42 + index * 0.01,
          limit: 5_000_000 + index * 120_000,
          available: 2_000_000 + index * 90_000,
          updatedAt: new Date().toISOString(),
          owner: 'Priya Singh',
          status: index % 3 === 0 ? 'review' : 'active'
        })),
        page: 1,
        pageSize,
        total: 12
      },
      2: {
        items: Array.from({ length: 4 }).map((_, index) => ({
          id: `line-${pageSize + index + 1}`,
          name: `HSBC Global ${index + 1}`,
          utilization: 0.31 + index * 0.02,
          limit: 4_500_000 + index * 100_000,
          available: 1_900_000 + index * 80_000,
          updatedAt: new Date().toISOString(),
          owner: 'Luis Martinez',
          status: index % 2 === 0 ? 'review' : 'hold'
        })),
        page: 2,
        pageSize,
        total: 12
      }
    } as const;

    await page.route('**/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dashboardResponse)
      });
    });

    await page.route('**/bank-lines**', async (route) => {
      const url = new URL(route.request().url());
      const requestPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      const payload = bankLinePages[requestPage as 1 | 2] ?? bankLinePages[1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload)
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Treasury Dashboard' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(4);
    await expectPageToBeAccessible(page);

    await page.getByRole('link', { name: 'Bank Lines' }).click();
    await expect(page.getByRole('heading', { name: 'Bank Lines' })).toBeVisible();

    const firstRow = page.getByRole('row', { name: /Citi International 1/ });
    await expect(firstRow).toBeVisible();
    await firstRow.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Citi International 1' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Verify RPT' })).toHaveAttribute('href', '/audit/rpt/by-line/line-1');

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('row', { name: /HSBC Global 1/ })).toBeVisible();

    await expectPageToBeAccessible(page);
  });
});
