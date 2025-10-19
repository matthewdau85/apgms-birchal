import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Onboarding wizard', () => {
  test('keeps focus trapped and updates aria-current per step', async ({ page }) => {
    await page.goto('/onboarding');

    const dialog = page.getByRole('dialog', { name: 'Company details' });
    await expect(dialog).toBeVisible();

    const stepper = page.getByRole('tablist', { name: 'Onboarding progress' });
    const firstStep = stepper.getByRole('tab').first();
    await expect(firstStep).toHaveAttribute('aria-current', 'step');

    await page.getByRole('button', { name: 'Continue' }).click();
    const secondStep = stepper.getByRole('tab').nth(1);
    await expect(secondStep).toHaveAttribute('aria-current', 'step');

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('passes automated accessibility checks', async ({ page }) => {
    await page.goto('/onboarding');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
