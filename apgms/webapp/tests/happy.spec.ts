import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

const withBaseUrl = (path: string) => new URL(path, BASE_URL).toString();

test.describe('Bank line happy path', () => {
  test('user can open, verify, and close a bank line drawer', async ({ page }) => {
    await test.step('Visit the dashboard and confirm KPIs are visible', async () => {
      await page.goto(withBaseUrl('/'));
      const kpiSection = page.getByTestId('kpi-section');
      await expect(kpiSection, 'KPI section should be present on the landing page').toBeVisible();
      await expect(
        kpiSection.getByRole('heading', { level: 2, name: /key performance indicators/i })
      ).toBeVisible();
    });

    await test.step('Open the first bank line drawer', async () => {
      await page.goto(withBaseUrl('/bank-lines'));
      const lineItem = page.getByTestId('bank-line-item').first();
      await expect(lineItem, 'Expected at least one bank line item to display').toBeVisible();
      await lineItem.click();
    });

    const drawer = page.getByRole('dialog', { name: /bank line details/i });
    await expect(drawer, 'Drawer with bank line details should be visible').toBeVisible();

    await test.step('Verify the bank line from the drawer', async () => {
      await drawer.getByRole('button', { name: /verify/i }).click();
      await expect(drawer.getByTestId('verification-status')).toContainText(/verified/i);
    });

    await test.step('Close the drawer after verification', async () => {
      await drawer.getByRole('button', { name: /close/i }).click();
      await expect(drawer).not.toBeVisible();
    });
  });
});
