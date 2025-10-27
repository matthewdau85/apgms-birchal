import { strict as assert } from 'node:assert';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import {
  AuditService,
  InMemoryEmailClient,
  InMemoryWebhookClient,
} from '../../services/audit/src/index.js';
import {
  BasDeadlineRepository,
  ComplianceWorker,
  VerificationRepository,
} from '../src/index.js';

const createAuditService = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'compliance-worker-'));
  const archivePath = join(dir, 'audit.log');
  const emailClient = new InMemoryEmailClient();
  const webhookClient = new InMemoryWebhookClient();
  const service = new AuditService({
    archivePath,
    emailClient,
    webhookClient,
    notificationRules: {
      COMPLIANCE: {
        emails: ['compliance@example.test'],
        webhooks: ['https://hooks.example.test/compliance'],
      },
      DISCREPANCY: {
        emails: ['alerts@example.test'],
        webhooks: ['https://hooks.example.test/security'],
      },
    },
  });
  return { service, emailClient, webhookClient };
};

describe('ComplianceWorker', () => {
  let deadlineRepository: BasDeadlineRepository;
  let verificationRepository: VerificationRepository;
  let emailClient: InMemoryEmailClient;
  let webhookClient: InMemoryWebhookClient;
  let worker: ComplianceWorker;

  beforeEach(async () => {
    deadlineRepository = new BasDeadlineRepository();
    verificationRepository = new VerificationRepository();
    const { service, emailClient: emails, webhookClient: webhooks } = await createAuditService();
    emailClient = emails;
    webhookClient = webhooks;
    worker = new ComplianceWorker({
      auditService: service,
      deadlineRepository,
      verificationRepository,
      scheduler: () => ({ dispose: () => undefined }),
      deadlineAlertThresholdDays: 10,
      deadlineAlertCooldownMs: 0,
    });
  });

  it('emits alerts for upcoming BAS deadlines', async () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    worker.registerDeadline({
      id: 'bas-1',
      entityId: 'entity-100',
      dueDate,
      status: 'PENDING',
      assignedTo: 'analyst@example.test',
      description: 'Quarterly BAS',
    });

    await worker.processUpcomingBasDeadlines(new Date());

    assert.equal(emailClient.messages.length, 1);
    assert.equal(emailClient.messages[0]?.to, 'compliance@example.test');
    assert.equal(webhookClient.payloads.length, 1);
    assert.equal(webhookClient.payloads[0]?.body.entityId, 'entity-100');

    const state = deadlineRepository.getUpcoming(new Date(), 10, 60 * 60 * 1000);
    assert.equal(state.length, 0, 'deadline should be suppressed after alert');
  });

  it('applies temporary holds after repeated MFA failures', async () => {
    const now = new Date();
    worker.recordMfaFailure('entity-200', now);
    worker.recordMfaFailure('entity-200', new Date(now.getTime() + 1_000));
    worker.recordMfaFailure('entity-200', new Date(now.getTime() + 2_000));

    await worker.enforceTemporaryHolds(new Date(now.getTime() + 3_000));

    const verification = verificationRepository.getState('entity-200');
    assert.equal(verification?.holdActive, true);
    assert.equal(emailClient.messages.at(-1)?.to, 'alerts@example.test');
    assert.equal(webhookClient.payloads.at(-1)?.url, 'https://hooks.example.test/security');
  });

  it('lifts holds after successful verification and logs compliance recovery', async () => {
    const now = new Date();
    worker.recordMfaFailure('entity-300', now);
    worker.recordMfaFailure('entity-300', new Date(now.getTime() + 1_000));
    worker.recordMfaFailure('entity-300', new Date(now.getTime() + 2_000));
    await worker.enforceTemporaryHolds(new Date(now.getTime() + 3_000));

    const preSuccessMessages = emailClient.messages.length;
    await worker.recordMfaSuccess('entity-300');

    const state = verificationRepository.getState('entity-300');
    assert.equal(state?.holdActive, false);
    assert.equal(emailClient.messages.length, preSuccessMessages + 1);
    assert.match(emailClient.messages.at(-1)?.subject ?? '', /Temporary hold lifted/);
  });
});
