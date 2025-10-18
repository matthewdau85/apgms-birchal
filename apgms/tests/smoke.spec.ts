import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('KPIs render on the dashboard', async ({ page }) => {
    await page.goto('/');

    const kpiCards = page.locator('[data-testid="kpi-card"]');
    const kpiEmptyState = page.locator('[data-testid="kpis-empty"], [data-testid="kpis-empty-state"]');

    const kpiCardCount = await kpiCards.count();

    if (kpiCardCount > 0) {
      await expect(kpiCards.first()).toBeVisible();
      return;
    }

    if ((await kpiEmptyState.count()) > 0) {
      await expect(kpiEmptyState.first()).toBeVisible();
      return;
    }

    throw new Error('Expected KPI cards or KPI empty state to be visible.');
  });

  test('Bank line drawer exposes Verify RPT action', async ({ page }) => {
    await page.goto('/bank-lines?orgId=org_demo');

    const dataRow = page
      .getByRole('row')
      .filter({ has: page.getByRole('cell') })
      .first();

    await expect(dataRow).toBeVisible();
    await dataRow.click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    const verifyButton = drawer.getByRole('button', { name: /verify rpt/i });
    await expect(verifyButton).toBeVisible();
    await expect(verifyButton).toBeEnabled();

    await verifyButton.focus();
    await expect(verifyButton).toBeFocused();
  });
});
