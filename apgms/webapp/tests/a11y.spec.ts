import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    axe: {
      run: (context?: unknown, options?: unknown) => Promise<AxeResults>;
    };
  }
}

interface AxeNodeResult {
  target: string[];
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact?: string;
  help: string;
  helpUrl: string;
  nodes: AxeNodeResult[];
}

interface AxeResults {
  violations: AxeViolation[];
}

const routesToTest = ['/', '/bank-lines'] as const;
const axeSourceUrl =
  process.env.AXE_SOURCE_URL ?? 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) {
    return 'No accessibility violations found by axe-core.';
  }

  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `  • ${node.target.join(' ')}${node.failureSummary ? `\n    ${node.failureSummary}` : ''}`)
        .join('\n');
      const impact = violation.impact ? ` [${violation.impact}]` : '';
      return `${violation.id}${impact}: ${violation.help}\n${targets}\n    More info: ${violation.helpUrl}`;
    })
    .join('\n\n');
}

test.describe('Accessibility', () => {
  for (const route of routesToTest) {
    test(`has no accessibility violations on ${route}`, async ({ page }, testInfo) => {
      const baseURL =
        testInfo.project.use?.baseURL ?? process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:3000';
      const url = new URL(route, baseURL).toString();

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ url: axeSourceUrl });

      const results = await page.evaluate<AxeResults>(async () => {
        if (!window.axe) {
          throw new Error('axe-core failed to load on the page.');
        }
        return window.axe.run();
      });

      await testInfo.attach(`axe-${route.replace(/\W+/g, '-') || 'root'}.json`, {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });

      expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
    });
  }
});
