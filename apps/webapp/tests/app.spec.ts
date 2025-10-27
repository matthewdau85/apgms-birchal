import { test, expect } from '@playwright/test';

test('renders health', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.getByText('API health: ok')).toBeVisible();
});
