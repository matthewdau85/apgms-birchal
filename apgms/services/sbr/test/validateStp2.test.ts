import test from 'node:test';

import invalidAbn from './fixtures/invalid-abn.json' with { type: 'json' };
import invalidPaymentDate from './fixtures/invalid-payment-date.json' with { type: 'json' };
import invalidTfn from './fixtures/invalid-tfn.json' with { type: 'json' };
import negativeGross from './fixtures/negative-gross.json' with { type: 'json' };
import validPayEvent from './fixtures/valid-pay-event.json' with { type: 'json' };
import { validateStp2 } from '../src/validate-stp2.js';

function assertOk(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepStrictEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected: ${expectedJson}\nreceived: ${actualJson}`);
  }
}

test('returns no errors for a compliant payload', () => {
  assertDeepStrictEqual(validateStp2(validPayEvent), [], 'Expected valid payload to return no errors');
});

test('captures an invalid employer ABN with the correct rule identifier', () => {
  const result = validateStp2(invalidAbn);
  assertOk(
    result.some((error) => error.path === '/payEvent/employer/abn' && error.ruleId === 'STP2-R-0101'),
    'Expected invalid ABN to trigger STP2-R-0101'
  );
});

test('captures an invalid TFN with the correct rule identifier', () => {
  const result = validateStp2(invalidTfn);
  assertOk(
    result.some(
      (error) => error.path === '/payEvent/employees/0/taxFileNumber' && error.ruleId === 'STP2-R-0201'
    ),
    'Expected invalid TFN to trigger STP2-R-0201'
  );
});

test('captures a non ISO formatted payment date', () => {
  const result = validateStp2(invalidPaymentDate);
  assertOk(
    result.some((error) => error.path === '/payEvent/paymentDate' && error.ruleId === 'STP2-R-0301'),
    'Expected non ISO payment date to trigger STP2-R-0301'
  );
});

test('captures negative gross amounts as a breach of the gross amount rule', () => {
  const result = validateStp2(negativeGross);
  assertOk(
    result.some(
      (error) => error.path === '/payEvent/employees/0/payments/0/grossAmount' && error.ruleId === 'STP2-R-0402'
    ),
    'Expected negative gross amount to trigger STP2-R-0402'
  );
});
