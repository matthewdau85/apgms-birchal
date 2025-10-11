import assert from 'node:assert/strict';
import test from 'node:test';
import { exportAbaFile } from '../src/exporters/abaExporter.js';

const header = {
  financialInstitution: 'ANZ',
  userName: 'Birchal Payments',
  userNumber: '123456',
  description: 'Disbursement',
  processDate: new Date('2024-03-12T00:00:00.000Z')
};

const transactions = [
  {
    bsb: '123-456',
    accountNumber: '987654321',
    accountName: 'First Investor',
    amountCents: 12345,
    lodgementReference: 'INVESTMENT1',
    traceBsb: '654-321',
    traceAccountNumber: '000111222',
    remitterName: 'Birchal',
    transactionCode: '53'
  },
  {
    bsb: '082-991',
    accountNumber: '000123456',
    accountName: 'Second Investor',
    amountCents: 67890,
    lodgementReference: 'INVESTMENT2',
    traceBsb: '654-321',
    traceAccountNumber: '000111222',
    remitterName: 'Birchal'
  }
];

test('exportAbaFile creates deterministic ABA contents', () => {
  const aba = exportAbaFile(header, transactions);
  const lines = aba.split('\n').filter((line) => line.length > 0);

  assert.equal(lines.length, 4);
  assert.ok(lines.every((line) => line.length === 120));

  assert.equal(
    lines[0],
    '0                ANZ       BIRCHAL PAYMENTS          123456DISBURSEMENT120324                                           '
  );

  assert.equal(
    lines[1],
    '10123456987654321 530000012345FIRST INVESTOR                  INVESTMENT1       0654321000111222BIRCHAL         00000000'
  );

  assert.equal(
    lines[2],
    '10082991000123456 500000067890SECOND INVESTOR                 INVESTMENT2       0654321000111222BIRCHAL         00000000'
  );

  assert.equal(
    lines[3],
    '7                   000008023500000000000000080235                        000002                                        '
  );
});

test('exportAbaFile trailer totals', () => {
  const aba = exportAbaFile(header, transactions);
  const lines = aba.split('\n').filter((line) => line.length > 0);
  const trailer = lines[lines.length - 1];

  assert.equal(
    trailer,
    '7                   000008023500000000000000080235                        000002                                        '
  );
});
