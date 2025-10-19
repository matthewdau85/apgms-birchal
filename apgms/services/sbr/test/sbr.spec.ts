import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rm, stat, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJsonStringify, sendSbrDocument } from "../src/as4.stub";

const artifactDir = path.resolve(process.cwd(), "artifacts", "sbr");

beforeEach(async () => {
  await rm(artifactDir, { recursive: true, force: true });
});

after(async () => {
  await rm(artifactDir, { recursive: true, force: true });
});

test("sendSbrDocument persists artifacts and signs payload", async () => {
  const payload = {
    lodgementReference: "LR-12345",
    period: { from: "2024-07-01", to: "2024-09-30" },
    amounts: [100, 250.45],
  };

  const result = await sendSbrDocument({
    orgId: "ORG-123",
    documentType: "PAYEVNT",
    payload,
  });

  assert.equal(result.envelope.header.sender, "ORG-123");
  assert.equal(result.envelope.header.documentType, "PAYEVNT");
  assert.match(result.envelope.header.messageId, /[0-9a-f-]{36}/);
  assert.match(result.envelope.header.conversationId, /[0-9a-f-]{36}/);
  assert.ok(new Date(result.envelope.header.createdAt).toString() !== "Invalid Date");
  assert.equal(result.envelope.signature.algorithm, "sha256");
  assert.equal(result.envelope.signature.canonicalization, "json");

  const expectedDigest = createHash("sha256")
    .update(canonicalJsonStringify(payload))
    .digest("hex");
  assert.equal(result.envelope.signature.digest, expectedDigest);

  const envelopeStat = await stat(result.envelopePath);
  assert.ok(envelopeStat.isFile());
  const metadataStat = await stat(result.metadataPath);
  assert.ok(metadataStat.isFile());

  const storedEnvelope = JSON.parse(await readFile(result.envelopePath, "utf8"));
  assert.deepEqual(storedEnvelope, result.envelope);

  const metadata = JSON.parse(await readFile(result.metadataPath, "utf8"));
  assert.equal(metadata.messageId, result.envelope.header.messageId);
  assert.equal(metadata.documentType, "PAYEVNT");
  assert.equal(metadata.payloadDigest, expectedDigest);
  assert.equal(metadata.envelopeFile, path.basename(result.envelopePath));
});

