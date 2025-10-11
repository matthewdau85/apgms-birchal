import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvTransactions, parseQifTransactions, parseOfxTransactions } from '../src/parsers.js';

test('parseCsvTransactions parses simple CSV content', () => {
  const csv = `date,amount,description,id\n2024-05-01,123.45,Acme Supplies,L1\n2024-05-03,-45.67,Coffee Corner,L2`;
  const result = parseCsvTransactions(csv);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'L1');
  assert.equal(result[0].amount, 123.45);
  assert.equal(result[1].description, 'Coffee Corner');
});

test('parseQifTransactions parses QIF blocks', () => {
  const qif = `!Type:Bank\nD2024-05-01\nT123.45\nPAcme Supplies\n^\nD2024-05-02\nT-45.67\nPCoffee Corner\nMLatte run\n^`;
  const result = parseQifTransactions(qif);
  assert.equal(result.length, 2);
  assert.equal(result[0].description, 'Acme Supplies');
  assert.equal(result[1].description, 'Coffee Corner Latte run');
  assert.equal(result[1].amount, -45.67);
});

test('parseOfxTransactions parses minimal OFX content', () => {
  const ofx = `
  <OFX>
    <BANKTRANLIST>
      <STMTTRN>
        <DTPOSTED>20240501
        <TRNAMT>123.45
        <FITID>TXN001
        <NAME>Acme Supplies</NAME>
      </STMTTRN>
      <STMTTRN>
        <DTPOSTED>20240503
        <TRNAMT>-45.67
        <FITID>TXN002
        <MEMO>Coffee Corner</MEMO>
      </STMTTRN>
    </BANKTRANLIST>
  </OFX>`;
  const result = parseOfxTransactions(ofx);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'TXN001');
  assert.equal(result[1].description, 'Coffee Corner');
  assert.equal(result[1].amount, -45.67);
});
