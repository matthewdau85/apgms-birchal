import { strict as assert } from 'node:assert';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import {
  AuditService,
  InMemoryEmailClient,
  InMemoryWebhookClient,
  type AuditEvent,
} from '../src/index.js';

const createTempArchivePath = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'audit-service-'));
  return join(dir, 'archive.log');
};

describe('AuditService', () => {
  let emailClient: InMemoryEmailClient;
  let webhookClient: InMemoryWebhookClient;
  let service: AuditService;
  let archivePath: string;

  beforeEach(async () => {
    emailClient = new InMemoryEmailClient();
    webhookClient = new InMemoryWebhookClient();
    archivePath = await createTempArchivePath();
    service = new AuditService({
      archivePath,
      emailClient,
      webhookClient,
      notificationRules: {
        ALL: {
          emails: ['audit-team@example.test'],
          webhooks: ['https://hooks.example.test/audit'],
        },
      },
    });
  });

  it('archives events and dispatches notifications when ingesting', async () => {
    const event = await service.ingest({
      kind: 'DISCREPANCY',
      entityId: 'txn-123',
      description: 'Payment mismatch detected',
      severity: 'HIGH',
      metadata: { variance: 145.25 },
    });

    assert.equal(emailClient.messages.length, 1);
    assert.equal(emailClient.messages[0]?.to, 'audit-team@example.test');
    assert.match(emailClient.messages[0]?.subject ?? '', /DISCREPANCY/);
    assert.equal(webhookClient.payloads.length, 1);
    assert.equal(webhookClient.payloads[0]?.url, 'https://hooks.example.test/audit');
    assert.equal(webhookClient.payloads[0]?.body.id, event.id);

    const archived = await service.getArchivedEvents();
    assert.equal(archived.length, 1);
    assert.deepEqual(stripTransientFields(archived[0]!), stripTransientFields(event));
  });

  it('recovers events that were previously archived', async () => {
    await service.ingest({
      kind: 'COMPLIANCE',
      entityId: 'entity-42',
      description: 'Compliance attestation received',
      metadata: { attestedBy: 'compliance.officer@example.test' },
    });

    const secondary = new AuditService({
      archivePath,
      emailClient,
      webhookClient,
    });

    const recovered = await secondary.recoverFromArchive();
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.entityId, 'entity-42');
    assert.equal(secondary.getRecentEvents().length, 1);
  });
});

const stripTransientFields = (event: AuditEvent) => ({
  ...event,
  id: 'static',
  timestamp: new Date(0),
});
