import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { buildEnvelope, persistArtifacts, signEnvelope } from '../src/index.js';

const tmpDir = path.resolve(process.cwd(), 'tmp');

const samplePayload = {
  amount: 42,
  currency: 'AUD',
  meta: { purpose: 'testing', tags: ['alpha', 'beta'] },
};

const baseConfig = {
  service: 'BusinessRegistry',
  action: 'SubmitDocument',
  from: 'APGMS',
  to: 'SBR',
} as const;

describe('AS4 client scaffold', () => {
  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('builds deterministic envelopes for the same payload and config', () => {
    const first = buildEnvelope(samplePayload, baseConfig);
    const second = buildEnvelope(samplePayload, baseConfig);

    assert.deepStrictEqual(first, second);
    assert.match(first.messageId, /^as4-[a-f0-9]{64}$/);
    assert.equal(first.parties.from, baseConfig.from);
    assert.equal(first.parties.to, baseConfig.to);
  });

  it('persists envelope and receipt artifacts to tmp/ with message ID naming', async () => {
    const envelope = buildEnvelope(samplePayload, baseConfig);
    const receipt = signEnvelope(envelope, 'stub-key');

    const { envelopePath, receiptPath } = await persistArtifacts({ envelope, receipt });

    assert.equal(path.dirname(envelopePath), tmpDir);
    assert.equal(path.dirname(receiptPath), tmpDir);
    assert.equal(path.basename(envelopePath), `${envelope.messageId}-envelope.json`);
    assert.equal(path.basename(receiptPath), `${envelope.messageId}-receipt.json`);

    const storedEnvelope = JSON.parse(await fs.readFile(envelopePath, 'utf-8'));
    const storedReceipt = JSON.parse(await fs.readFile(receiptPath, 'utf-8'));

    assert.deepStrictEqual(storedEnvelope, envelope);
    assert.deepStrictEqual(storedReceipt, receipt);
  });
});
