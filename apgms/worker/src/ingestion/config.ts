import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { IngestionTarget } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

export const TAX_INGESTION_TARGETS: IngestionTarget[] = [
  {
    slug: 'individual-income-tax-rates',
    sourceUrl: 'https://www.ato.gov.au/rates/individual-income-tax-rates/',
    fixturePath: join(root, 'test', 'fixtures', 'individual-income-tax-rates.html'),
    generatedPath: join(root, 'generated', 'individual-income-tax-rates.json'),
    goldenPath: join(root, 'test', 'golden', 'individual-income-tax-rates.json'),
    summaryPath: join(root, 'generated', 'individual-income-tax-rates.summary.md'),
  },
];

export const STATE_PATH = join(root, 'state', 'ato-tax-ingestion-state.json');
export const SUMMARY_AGGREGATE_PATH = join(root, 'generated', 'ato-tax-ingestion-summary.md');
