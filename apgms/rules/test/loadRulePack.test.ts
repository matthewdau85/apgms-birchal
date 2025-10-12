import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadRulePack } from '../src/index.js';

const originalRoot = process.env.APGMS_RULES_ROOT;

afterEach(() => {
  if (originalRoot === undefined) {
    delete process.env.APGMS_RULES_ROOT;
  } else {
    process.env.APGMS_RULES_ROOT = originalRoot;
  }
});

test('returns the latest GST pack for the given date', async () => {
  const pack = await loadRulePack('gst', '2024-08-01');

  assert.equal(pack.meta.source, 'ATO GST reference 2024');
  assert.deepEqual(pack.rules, { rate: 0.1, low_value_threshold: 82000 });
});

test('returns the variant specific pack when provided', async () => {
  const pack = await loadRulePack('gst', '2024-08-01', 'reduced');

  assert.equal(pack.meta.variant, 'reduced');
  assert.deepEqual(pack.rules, { rate: 0.05, low_value_threshold: 60000 });
});

test('returns PAYGW pack matching the date range', async () => {
  const pack = await loadRulePack('paygw', '2024-03-01');

  assert.equal(pack.meta.effective_from, '2024-01-01');
  assert.equal((pack.rules as Record<string, unknown>).tax_free_threshold, 18200);
});

test('throws when no pack covers the requested date', async () => {
  await assert.rejects(
    loadRulePack('gst', '2022-01-01'),
    new Error('No rule pack found for domain "gst" on 2022-01-01'),
  );
});

test('throws a descriptive validation error for invalid packs', async () => {
  const tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'rules-test-'));
  const gstDir = path.join(tempRoot, 'gst');
  await fs.mkdir(gstDir, { recursive: true });

  await fs.writeFile(
    path.join(gstDir, 'broken.json'),
    JSON.stringify(
      {
        meta: {
          domain: 'gst',
          effective_from: '2024-01-01',
          schema_version: '1.0.0',
        },
        rules: {},
      },
      null,
      2,
    ),
  );

  process.env.APGMS_RULES_ROOT = tempRoot;

  await assert.rejects(loadRulePack('gst', '2024-05-01'), (error) => {
    assert.match((error as Error).message, /missing fields: meta.source/);
    return true;
  });
});
