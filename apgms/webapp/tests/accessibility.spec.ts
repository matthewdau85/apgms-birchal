import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  { path: '/', title: 'Dashboard' },
  { path: '/bas-workspace', title: 'BAS Workspace' },
  { path: '/recon-center', title: 'Recon Center' },
  { path: '/evidence-audit', title: 'Evidence & Audit' },
  { path: '/settings', title: 'Settings' },
  { path: '/onboarding', title: 'Onboarding Wizard' }
];

test.describe('core route accessibility', () => {
  for (const route of routes) {
    test(`no critical accessibility issues on ${route.title}`, async ({ page }) => {
      await page.goto(route.path);
      const results = await new AxeBuilder({ page }).analyze();
      const criticalViolations = results.violations.filter(violation => violation.impact === 'critical');
      expect(criticalViolations).toEqual([]);
    });
  }
});
