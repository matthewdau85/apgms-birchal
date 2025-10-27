import assert from 'node:assert/strict';
import { diffTaxRules } from '../../src/ingestion/summary.js';
import type { TaxRules } from '../../src/ingestion/types.js';

const baseRules: TaxRules = {
  slug: 'individual-income-tax-rates',
  effectiveFrom: '2024-07-01',
  sourceUrl: 'https://example.test/rates',
  brackets: [
    { index: 0, lower: 0, upper: 18200, marginalRate: 0, baseTax: 0, threshold: 0 },
    { index: 1, lower: 18201, upper: 45000, marginalRate: 0.19, baseTax: 0, threshold: 18200 }
  ]
};

const updatedRules: TaxRules = {
  ...baseRules,
  effectiveFrom: '2025-07-01',
  brackets: [
    { index: 0, lower: 0, upper: 18200, marginalRate: 0, baseTax: 0, threshold: 0 },
    { index: 1, lower: 18201, upper: 48000, marginalRate: 0.2, baseTax: 0, threshold: 18200 },
    { index: 2, lower: 48001, upper: null, marginalRate: 0.32, baseTax: 5000, threshold: 48000 }
  ]
};

const summary = diffTaxRules(baseRules, updatedRules);

assert(summary.includes('Effective from updated from 2024-07-01 to 2025-07-01.'));
assert(summary.includes('Marginal rate for bracket 2'));
assert(summary.includes('Income range for bracket 2'));
assert(summary.includes('Added 1 bracket'));
