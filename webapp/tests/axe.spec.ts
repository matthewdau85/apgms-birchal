import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Dashboard accessibility', () => {
  test('has no detectable a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('h1:has-text("Warehouse Dashboard")');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('verify workflow is keyboard accessible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('button:has-text("Verify RPT")');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('role=dialog button', { hasText: 'Cancel' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('role=dialog button', { hasText: 'Mark as verified' })).toBeFocused();
  });
});
