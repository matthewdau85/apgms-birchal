import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

import {
  ARTIFACT_ROOT,
  artifactIdToPath,
  buildAs4Envelope,
  buildSbrServer,
  canonicalizePayload,
  computeCanonicalHash,
  createReceipt,
  persistArtifacts,
} from '../src/index.js';

const removeArtifacts = async () => {
  await fs.rm(ARTIFACT_ROOT, { recursive: true, force: true });
};

test('SBR AS4 envelope scaffolding', async (t) => {
  t.beforeEach(removeArtifacts);
  t.afterEach(removeArtifacts);

  await t.test('creates artifacts on send and exposes retrieval endpoint', async () => {
    const app = await buildSbrServer();

    const sendResponse = await app.inject({
      method: 'POST',
      url: '/sbr/send',
      payload: { payload: { b: 2, a: 1 } },
    });

    assert.equal(sendResponse.statusCode, 201);

    const body = sendResponse.json() as {
      messageId: string;
      artifacts: Record<string, string>;
    };

    const artifactIds = body.artifacts;
    const artifactNames = ['envelope', 'digest', 'receipt', 'messageId', 'signature'] as const;

    for (const name of artifactNames) {
      assert.ok(artifactIds[name]);
      const { path: artifactPath } = artifactIdToPath(artifactIds[name]);
      const exists = await fs
        .access(artifactPath)
        .then(() => true)
        .catch(() => false);
      assert.ok(exists);
    }

    const digestResponse = await app.inject({
      method: 'GET',
      url: `/sbr/artifact/${artifactIds.digest}`,
    });

    assert.equal(digestResponse.statusCode, 200);
    const digestContent = digestResponse.body.trim();

    const { path: envelopePath } = artifactIdToPath(artifactIds.envelope);
    const storedEnvelope = await fs.readFile(envelopePath, 'utf-8');
    assert.equal(digestContent, computeCanonicalHash(storedEnvelope));
  });

  await t.test('produces deterministic canonical hashes for equivalent payloads', async () => {
    const createdAt = '2024-01-01T00:00:00.000Z';
    const messageId = 'msg-test-id';

    const first = buildAs4Envelope({
      messageId,
      payload: { b: 2, a: 1, nested: { z: 3, y: 2 } },
      createdAt,
    });

    const second = buildAs4Envelope({
      messageId,
      payload: { nested: { y: 2, z: 3 }, a: 1, b: 2 },
      createdAt,
    });

    assert.equal(first.envelope, second.envelope);

    const digest = computeCanonicalHash(first.envelope);
    assert.equal(digest, computeCanonicalHash(second.envelope));
  });

  await t.test('creates a signed receipt with persisted digest and message id', async () => {
    const messageId = 'msg-receipt-test';
    const createdAt = '2024-01-01T00:00:00.000Z';
    const { envelope } = buildAs4Envelope({ messageId, payload: { value: 1 }, createdAt });
    const digest = computeCanonicalHash(envelope);
    const receipt = createReceipt({
      messageId,
      digest,
      signature: 'stub-signature',
      createdAt,
    });

    const artifacts = await persistArtifacts({
      messageId,
      envelope,
      digest,
      receipt,
      signature: 'stub-signature',
    });

    const receiptArtifact = artifacts.receipt;
    const { path: receiptPath } = artifactIdToPath(receiptArtifact);
    const storedReceipt = JSON.parse(await fs.readFile(receiptPath, 'utf-8'));
    assert.equal(storedReceipt.messageId, messageId);
    assert.equal(storedReceipt.digest, digest);
    assert.equal(storedReceipt.signature, 'stub-signature');
  });

  await t.test('canonicalizes payload structures consistently', () => {
    const payload = { z: 1, y: [3, 2, { b: 2, a: 1 }], x: 'value' };
    const canonical = canonicalizePayload(payload);
    assert.equal(canonical, '{"x":"value","y":[3,2,{"a":1,"b":2}],"z":1}');
  });
});
