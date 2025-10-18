import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { analyze } from 'axe-playwright';

async function expectNoAccessibilityViolations(page: Page, path: string) {
  await test.step(`check ${path}`, async () => {
    await page.goto(path);
    const results = await analyze(page, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    expect(results.violations, results.violations.map((violation) => violation.id).join(', ')).toEqual([]);
  });
}

test.describe('accessibility', () => {
  test('dashboard has no accessibility violations', async ({ page }) => {
    await expectNoAccessibilityViolations(page, '/');
  });

  test('bank lines have no accessibility violations', async ({ page }) => {
    await expectNoAccessibilityViolations(page, '/bank-lines');
  });
});
