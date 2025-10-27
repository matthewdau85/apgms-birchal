import { readFile } from 'fs/promises';
import assert from 'node:assert/strict';
import { parseAtoTaxTable } from '../../src/ingestion/parser.js';

const fixturePath = new URL('../fixtures/individual-income-tax-rates.html', import.meta.url);
const goldenPath = new URL('../golden/individual-income-tax-rates.json', import.meta.url);

const fixtureHtml = await readFile(fixturePath, 'utf8');
const golden = JSON.parse(await readFile(goldenPath, 'utf8'));

const parsed = parseAtoTaxTable(fixtureHtml, 'individual-income-tax-rates', 'https://example.test/rates');

assert.equal(parsed.brackets.length, golden.brackets.length, 'Bracket count mismatch');
assert.deepStrictEqual(parsed, {
  ...golden,
  sourceUrl: 'https://example.test/rates'
});
