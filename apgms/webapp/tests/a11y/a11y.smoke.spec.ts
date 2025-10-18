import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type A11yReport = {
  skipLinkFocused: boolean;
  mainContentFocused: boolean;
  tabSequence: string[];
  consoleErrors: string[];
  timestamp?: string;
};

const report: A11yReport = {
  skipLinkFocused: false,
  mainContentFocused: false,
  tabSequence: [],
  consoleErrors: [],
};

const webappRoot = path.resolve(__dirname, '../../..');
const reportDir = path.join(webappRoot, 'reports');
const reportPath = path.join(reportDir, 'a11y.json');
const htmlPath = path.join(webappRoot, 'index.html');

test('skip link activates and preserves keyboard order', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const html = await readFile(htmlPath, 'utf-8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const skipLink = page.locator('a.skip-link');
  const mainContent = page.locator('#main-content');
  const navLinks = page.locator('nav a');

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  report.skipLinkFocused = true;

  await page.keyboard.press('Enter');
  await expect(mainContent).toBeFocused();
  report.mainContentFocused = true;

  const tabbedLabels: string[] = [];
  const linkCount = await navLinks.count();
  for (let index = 0; index < linkCount; index += 1) {
    await page.keyboard.press('Tab');
    const currentLink = navLinks.nth(index);
    await expect(currentLink).toBeFocused();
    const label = ((await currentLink.textContent()) || '').trim();
    tabbedLabels.push(label);
  }

  report.tabSequence = tabbedLabels;
  report.consoleErrors = consoleErrors;

  await expect(consoleErrors, 'console errors should be empty').toHaveLength(0);
});

test.afterAll(async () => {
  report.timestamp = new Date().toISOString();
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
});
