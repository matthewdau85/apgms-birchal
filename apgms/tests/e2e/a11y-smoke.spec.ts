import path from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const a11yPageUrl = `file://${path.resolve(__dirname, '../../webapp/public/a11y-smoke.html')}`;

test.describe('accessibility smoke', () => {
  test('app shell has no critical accessibility violations', async ({ page }) => {
    await page.goto(a11yPageUrl);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.impact === 'critical',
    );

    expect(criticalViolations, JSON.stringify(criticalViolations, null, 2)).toEqual([]);
  });
});
