import AxeBuilder from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import { expect, test } from '@playwright/test';

const routes = ['/', '/bank-lines'];

for (const route of routes) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
}

function formatViolations(violations: AxeResults['violations']): string {
  if (!violations.length) {
    return 'No accessibility violations detected';
  }

  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.target.join(' ')}`)
        .join('\n');

      return `${violation.id} (${violation.impact ?? 'impact n/a'})\n${nodes}`;
    })
    .join('\n\n');
}
