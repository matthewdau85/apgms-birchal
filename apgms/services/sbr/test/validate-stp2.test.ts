import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { validateStp2 } from '../src/validate-stp2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadFixture<T>(name: string): T {
  const filePath = resolve(__dirname, 'fixtures', name);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

test('valid STP 2 payload passes with no validation errors', () => {
  const payload = loadFixture<Record<string, unknown>>('valid-stp2.json');
  const result = validateStp2(payload);
  assert.equal(result.length, 0);
});

test('missing required structures returns the correct rule identifiers', () => {
  const payload = loadFixture<Record<string, unknown>>('missing-required.json');
  const result = validateStp2(payload);

  const ruleIds = new Set(result.map((error) => error.ruleId));
  assert.ok(ruleIds.has('STP2.PAYEE.000'), 'payee rule id is returned');
  assert.ok(ruleIds.has('STP2.EVENT.000'), 'payroll event rule id is returned');

  const payeeError = result.find((error) => error.ruleId === 'STP2.PAYEE.000');
  assert.equal(payeeError?.path, 'payee');
  assert.equal(payeeError?.keyword, 'required');
});

test('invalid payer identifiers surface granular rule ids and paths', () => {
  const payload = loadFixture<Record<string, unknown>>('invalid-abn.json');
  const result = validateStp2(payload);

  const abnError = result.find((error) => error.path === 'payer.abn');
  assert.equal(abnError?.ruleId, 'STP2.PAYER.100');
  assert.match(abnError?.message ?? '', /11 digits/);

  const branchError = result.find((error) => error.path === 'payer.branch');
  assert.equal(branchError?.ruleId, 'STP2.PAYER.101');
  assert.equal(branchError?.keyword, 'maximum');

  const tfnError = result.find((error) => error.path === 'payee.tfn');
  assert.equal(tfnError?.ruleId, 'STP2.PAYEE.100');
});

test('invalid dates, enumerations and monetary amounts are all reported', () => {
  const payload = loadFixture<Record<string, unknown>>('invalid-dates.json');
  const result = validateStp2(payload);

  const dateOfBirthError = result.find((error) => error.path === 'payee.dateOfBirth');
  assert.equal(dateOfBirthError?.ruleId, 'STP2.PAYEE.101');

  const employmentError = result.find((error) => error.path === 'payee.employmentBasis');
  assert.equal(employmentError?.ruleId, 'STP2.PAYEE.120');
  assert.equal(employmentError?.keyword, 'enum');

  const incomeStreamError = result.find((error) => error.path === 'payee.incomeStreamType');
  assert.equal(incomeStreamError?.ruleId, 'STP2.PAYEE.121');

  const startDateError = result.find((error) => error.path === 'payrollEvent.payrollPeriod.startDate');
  assert.equal(startDateError?.ruleId, 'STP2.EVENT.100');

  const paymentDateError = result.find((error) => error.path === 'payrollEvent.paymentDate');
  assert.equal(paymentDateError?.ruleId, 'STP2.EVENT.102');

  const grossAmountError = result.find((error) => error.path === 'payrollEvent.grossAmount');
  assert.equal(grossAmountError?.ruleId, 'STP2.EVENT.200');
  assert.equal(grossAmountError?.keyword, 'minimum');

  const paygwAmountError = result.find((error) => error.path === 'payrollEvent.paygwAmount');
  assert.equal(paygwAmountError?.ruleId, 'STP2.EVENT.201');
  assert.equal(paygwAmountError?.keyword, 'multipleOf');

  const superError = result.find((error) => error.path === 'payrollEvent.superGuarantee');
  assert.equal(superError?.ruleId, 'STP2.EVENT.202');
  assert.equal(superError?.keyword, 'minimum');
});
