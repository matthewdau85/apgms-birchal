import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const routes = ['/', '/bank-lines'] as const;

test.describe('Accessibility scans', () => {
  for (const route of routes) {
    test(`has no detectable accessibility violations at ${route}`, async ({ page }) => {
      await page.goto(new URL(route, BASE_URL).toString());
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations, `Accessibility issues found on ${route}`).toEqual([]);
    });
  }
});
