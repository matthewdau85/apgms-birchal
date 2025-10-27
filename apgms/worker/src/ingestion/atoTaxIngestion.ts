import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';
import { TAX_INGESTION_TARGETS, STATE_PATH, SUMMARY_AGGREGATE_PATH } from './config.js';
import { fetchTarget } from './fetcher.js';
import { parseAtoTaxTable } from './parser.js';
import { diffTaxRules } from './summary.js';
import { readState, writeState } from './state.js';
import type { TaxRules } from './types.js';

async function ensureDir(path: string): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function readPreviousRules(path: string): Promise<TaxRules | null> {
  if (!existsSync(path)) {
    return null;
  }
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as TaxRules;
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir(path);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function writeSummary(path: string, summary: string): Promise<void> {
  await ensureDir(path);
  await writeFile(path, `${summary.trim()}\n`, 'utf8');
}

function shouldUseFixtures(): boolean {
  return process.env.ATO_TAX_INGESTION_USE_FIXTURES === '1';
}

export async function ingestAtoTaxTables(): Promise<{ summaries: string[]; changed: boolean }> {
  const useFixtures = shouldUseFixtures();
  const state = await readState(STATE_PATH);
  const summaries: string[] = [];
  let hasChanges = false;

  for (const target of TAX_INGESTION_TARGETS) {
    const { html, hash } = await fetchTarget(target, useFixtures);
    const previousState = state[target.slug];

    if (previousState && previousState.contentHash === hash) {
      summaries.push(`No changes detected for ${target.slug}.`);
      continue;
    }

    const previousRules = await readPreviousRules(target.generatedPath);
    const rules = parseAtoTaxTable(html, target.slug, target.sourceUrl);
    const summary = diffTaxRules(previousRules, rules);

    await writeJson(target.generatedPath, rules);
    await writeJson(target.goldenPath, rules);
    await writeSummary(target.summaryPath, summary);

    state[target.slug] = {
      contentHash: hash,
      effectiveFrom: rules.effectiveFrom,
      lastFetched: new Date().toISOString(),
      summary,
    };

    summaries.push(`Updates detected for ${target.slug}.\n${summary}`);
    hasChanges = true;
  }

  if (hasChanges) {
    await writeState(STATE_PATH, state);
    await writeSummary(SUMMARY_AGGREGATE_PATH, summaries.join('\n\n'));
  }

  return { summaries, changed: hasChanges };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAtoTaxTables()
    .then((result) => {
      console.log(result.summaries.join('\n\n'));
      if (!result.changed) {
        process.exitCode = 0;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
