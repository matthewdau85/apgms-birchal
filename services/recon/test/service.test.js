import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationService } from '../src/service.js';
import { InMemoryQueue } from '../src/queue.js';
import { AuditLogger } from '../src/audit.js';

const bankCsv = `date,amount,description,id\n2024-05-01,120.00,Acme Supplies Pty Ltd,B1\n2024-05-02,-45.67,Coffee Corner,B2\n2024-05-03,-89.10,Metro Transport,B3\n2024-05-04,-25.50,City Parking Station,B4\n2024-05-05,2500.00,Client Payment Invoice 104,B5\n2024-05-06,-19.99,Officeworks Stationery,B6\n2024-05-07,-60.00,Utility Energy Bill,B7\n2024-05-08,-15.75,Lunch Hub Catering,B8\n2024-05-09,-120.00,Team Dinner Catering,B9\n2024-05-10,-30.00,Mystery Transaction,B10`;

const ledgerOfx = `
<OFX>
  <BANKTRANLIST>
    <STMTTRN>
      <DTPOSTED>20240501
      <TRNAMT>120.00
      <FITID>L1
      <NAME>ACME SUPPLIES PTY</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240502
      <TRNAMT>-45.67
      <FITID>L2
      <NAME>Coffee Corner Cafe</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240503
      <TRNAMT>-89.10
      <FITID>L3
      <NAME>Metro Transport Services</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240504
      <TRNAMT>-25.50
      <FITID>L4
      <NAME>City Parking</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240505
      <TRNAMT>2500.00
      <FITID>L5
      <NAME>Client Payment 104</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240506
      <TRNAMT>-19.99
      <FITID>L6
      <NAME>Officeworks</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240507
      <TRNAMT>-60.00
      <FITID>L7
      <NAME>Utility Energy Pty</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240508
      <TRNAMT>-15.75
      <FITID>L8
      <NAME>Lunch Hub</NAME>
    </STMTTRN>
    <STMTTRN>
      <DTPOSTED>20240509
      <TRNAMT>-120.00
      <FITID>L9
      <NAME>Team Dinner Group</NAME>
    </STMTTRN>
  </BANKTRANLIST>
</OFX>`;

test('ReconciliationService auto matches >=90% and queues the rest', () => {
  const queue = new InMemoryQueue();
  const auditLogger = new AuditLogger();
  const service = new ReconciliationService({ queue, auditLogger, threshold: 0.9 });

  const { matches, queued } = service.reconcile({
    bank: { format: 'csv', data: bankCsv },
    ledger: { format: 'ofx', data: ledgerOfx }
  });

  assert.equal(matches.length, 9);
  assert.equal(queued.length, 1);
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].item.transaction.id, 'B10');

  const matchRate = matches.length / 10;
  assert.ok(matchRate >= 0.9);

  const matchEvents = auditLogger.events.filter((event) => event.type === 'match');
  const queuedEvents = auditLogger.events.filter((event) => event.type === 'queued');
  assert.equal(matchEvents.length, 9);
  assert.equal(queuedEvents.length, 1);
});
