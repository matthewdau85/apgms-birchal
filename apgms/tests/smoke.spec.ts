import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('dashboard KPIs render or show empty state', async ({ page }) => {
    await page.goto('/');

    const kpis = page.getByTestId('dashboard-kpis');
    const emptyState = page.getByTestId('dashboard-empty-state');

    await expect(kpis.or(emptyState)).toBeVisible();
  });

  test('verify button is focusable from bank line drawer', async ({ page }) => {
    await page.goto('/bank-lines?orgId=org_demo');

    const firstRow = page.getByRole('row').nth(1);
    await firstRow.click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    const verifyButton = drawer.getByRole('button', { name: /verify rpt/i });
    await expect(verifyButton).toBeVisible();
    await expect(verifyButton).toBeEnabled();

    await verifyButton.focus();
    await expect(verifyButton).toBeFocused();
  });
});
