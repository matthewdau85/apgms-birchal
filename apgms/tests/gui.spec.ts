import { test, expect, type Page } from '@playwright/test';

const captureConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
};

test.describe('Application shell', () => {
  test('renders dashboard with KPIs and chart without console errors', async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Portfolio overview' })).toBeVisible();
    const cards = page.locator('article.card');
    await expect(cards).toHaveCount(4);
    await expect(page.getByRole('img', { name: /Cash flow/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('navigates to bank lines and opens audit drawer', async ({ page }) => {
    await page.goto('/bank-lines');

    await expect(page.getByRole('heading', { name: 'Bank line management' })).toBeVisible();
    const rows = page.getByRole('row');
    expect(await rows.count()).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'View details' }).first().click();
    const drawer = page.getByRole('dialog', { name: /facility/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Audit trail' })).toBeVisible({ timeout: 5000 });
  });
});
