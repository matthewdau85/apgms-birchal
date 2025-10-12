import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { IngestionTarget } from './types.js';

export interface FetchResult {
  html: string;
  hash: string;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function fetchTarget(target: IngestionTarget, useFixtures = false): Promise<FetchResult> {
  if (useFixtures && existsSync(target.fixturePath)) {
    const html = await readFile(target.fixturePath, 'utf8');
    return { html, hash: sha256(html) };
  }

  const response = await fetch(target.sourceUrl, {
    headers: {
      'User-Agent': 'apgms-tax-ingestion/1.0 (+https://github.com/apgms)'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${target.sourceUrl}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  await writeFile(target.fixturePath, html, 'utf8');
  return { html, hash: sha256(html) };
}
