import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRulePack } from '../dist/index.js';

test('returns the default GST rule pack for a date', async () => {
  const pack = await loadRulePack('gst', '2024-02-15');
  assert.equal(pack.meta.schema_version, '1.0.0');
  assert.equal(pack.meta.variant, undefined);
  assert.deepEqual(pack.data, {
    rate: 0.1,
    description: 'Standard GST rate',
  });
});

test('returns the latest GST rule pack prior to the date', async () => {
  const pack = await loadRulePack('gst', '2024-08-01');
  assert.equal(pack.meta.effective_from, '2024-07-01');
  assert.deepEqual(pack.data, {
    rate: 0.12,
    description: 'GST rate after July 2024 uplift',
  });
});

test('returns a variant-specific rule pack when requested', async () => {
  const pack = await loadRulePack('gst', '2024-05-01', 'reduced');
  assert.equal(pack.meta.variant, 'reduced');
  assert.deepEqual(pack.data, {
    rate: 0.05,
    description: 'Reduced GST rate for specific program',
  });
});

test('throws a descriptive error when required fields are missing', async () => {
  await assert.rejects(loadRulePack('ftc', '2024-01-01'), /missing fields meta.schema_version/);
});
