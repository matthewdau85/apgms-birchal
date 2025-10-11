import test from 'node:test';
import assert from 'node:assert/strict';
import { matchTransactions, computeMatchScore } from '../src/matcher.js';

const ledgerTransactions = [
  { id: 'L1', date: new Date('2024-05-01'), amount: 123.45, description: 'Acme Supplies Pty Ltd' },
  { id: 'L2', date: new Date('2024-05-02'), amount: -45.67, description: 'Coffee Corner' },
  { id: 'L3', date: new Date('2024-05-03'), amount: -15.25, description: 'Downtown Parking' }
];

const bankTransactions = [
  { id: 'B1', date: new Date('2024-05-01'), amount: 123.45, description: 'ACME SUPPLIES PTY LTD' },
  { id: 'B2', date: new Date('2024-05-02'), amount: -45.67, description: 'Coffee Corner - Sydney' },
  { id: 'B3', date: new Date('2024-05-06'), amount: -15.25, description: 'Downtown Parking Garage' },
  { id: 'B4', date: new Date('2024-05-07'), amount: -22.0, description: 'Unknown Vendor' }
];

test('computeMatchScore gives higher values for similar transactions', () => {
  const exact = computeMatchScore(bankTransactions[0], ledgerTransactions[0]);
  const distant = computeMatchScore(bankTransactions[3], ledgerTransactions[0]);
  assert.ok(exact > 0.95);
  assert.ok(distant < exact);
});

test('matchTransactions auto matches above threshold and leaves difficult ones unmatched', () => {
  const { matches, unmatched } = matchTransactions(bankTransactions, ledgerTransactions, { threshold: 0.9 });
  assert.equal(matches.length, 3);
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].bank.id, 'B4');
  assert.equal(unmatched[0].score < 0.5, true);
});
