import { promises as fs } from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import type { Page } from '@playwright/test';

const results: Array<{ url: string; results: AxeResults }> = [];
const reportPath = path.resolve(__dirname, '..', '..', 'reports', 'a11y.json');

export async function initializeReport() {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  results.length = 0;
}

export async function analyzePage(page: Page) {
  const analysis = await new AxeBuilder({ page }).analyze();
  results.push({ url: page.url(), results: analysis });
  return analysis;
}

export async function writeReport() {
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
}
