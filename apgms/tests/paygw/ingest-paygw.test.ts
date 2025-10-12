import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildPaygwPacks,
  evaluateWithholding,
  parsePaygwCsv,
  writePaygwPacks,
  type IngestOptions,
} from '../../scripts/ingest-paygw.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, 'fixtures/2024-07-01_sample_tables.csv');

function loadSamplePacks() {
  const csv = fs.readFileSync(fixturePath, 'utf-8');
  const rows = parsePaygwCsv(csv);
  const options: IngestOptions = {
    effectiveFrom: '2024-07-01',
    source: 'ATO NAT 1005 (1 July 2024)',
    url: 'https://www.ato.gov.au',
    digest: 'sample-digest',
    sourcePath: fixturePath,
  };
  return buildPaygwPacks(rows, options);
}

test('parses PAYGW tables into normalised packs', () => {
  const packs = loadSamplePacks();
  assert.equal(packs.size, 3);

  const weekly = packs.get('weekly');
  assert.ok(weekly);
  assert.equal(weekly?.thresholds.length, 7);

  const monthly = packs.get('monthly');
  assert.ok(monthly);
  assert.equal(monthly?.thresholds.at(-1)?.upper, null);
});

test('matches ATO weekly worked examples', () => {
  const packs = loadSamplePacks();
  const weekly = packs.get('weekly');
  assert.ok(weekly);

  assert.equal(evaluateWithholding(weekly.thresholds, 80), 0);
  assert.equal(evaluateWithholding(weekly.thresholds, 500), 93);
  assert.equal(evaluateWithholding(weekly.thresholds, 1300), 365);
});

test('matches ATO fortnightly worked examples', () => {
  const packs = loadSamplePacks();
  const fortnightly = packs.get('fortnightly');
  assert.ok(fortnightly);

  assert.equal(evaluateWithholding(fortnightly.thresholds, 150), 0);
  assert.equal(evaluateWithholding(fortnightly.thresholds, 800), 139);
  assert.equal(evaluateWithholding(fortnightly.thresholds, 1500), 353);
});

test('matches ATO monthly worked examples', () => {
  const packs = loadSamplePacks();
  const monthly = packs.get('monthly');
  assert.ok(monthly);

  assert.equal(evaluateWithholding(monthly.thresholds, 700), 0);
  assert.equal(evaluateWithholding(monthly.thresholds, 3000), 423);
  assert.equal(evaluateWithholding(monthly.thresholds, 6000), 1349);
});

test('writes packs to JSON files in the rules directory', () => {
  const packs = loadSamplePacks();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paygw-'));
  writePaygwPacks(packs, tmpDir);

  const weeklyPath = path.join(tmpDir, '2024-07-01_weekly.json');
  assert.ok(fs.existsSync(weeklyPath));

  const payload = JSON.parse(fs.readFileSync(weeklyPath, 'utf-8'));
  assert.equal(payload.metadata.frequency, 'weekly');
  assert.equal(payload.thresholds.length, 7);
});
