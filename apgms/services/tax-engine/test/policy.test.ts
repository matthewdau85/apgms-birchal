import assert from 'node:assert/strict';
import test from 'node:test';
import { createPolicyRepository } from '../src/policy/repository.js';
import { createTaxEngine } from '../src/taxEngine.js';

const fixtureDate = new Date('2024-09-01T00:00:00.000Z');

test('PAYGW lookups are deterministic', async () => {
  const repository = await createPolicyRepository();
  const weekly = repository.getPaygwFor('weekly', 800, fixtureDate);
  const monthly = repository.getPaygwFor('monthly', 2500, fixtureDate);

  assert.equal(weekly, 118);
  assert.ok(Math.abs(monthly - 178.2) < 0.0001);
});

test('GST rate resolution uses metadata', async () => {
  const repository = await createPolicyRepository();
  const rate = repository.getGstRate(new Date('2023-05-01T00:00:00.000Z'));
  assert.equal(rate.rate, 0.1);
});

test('BAS label mapping returns internal field', async () => {
  const repository = await createPolicyRepository();
  const mapping = repository.getBasLabel('G1');
  assert.equal(mapping.internalField, 'sales.totalTaxable');
});

test('tax engine proxies policy lookups', async () => {
  const engine = await createTaxEngine();
  assert.equal(await engine.getPaygwFor('weekly', 500, fixtureDate), 33);
  assert.equal(await engine.getGstRate(new Date('2022-01-01T00:00:00.000Z')), 0.1);
  assert.equal(engine.getBasLabel('W1').category, 'PAYGW');
});
