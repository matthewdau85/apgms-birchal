import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import { createPublicKey, verify as verifyEd25519 } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, "../../../artifacts/kms");

async function importKms() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../../../services/api-gateway/src/lib/kms.ts"));
  return import(moduleUrl.href);
}

beforeEach(async () => {
  await fs.rm(artifactsDir, { recursive: true, force: true });
});

test("getSigner signs and verifies", async () => {
  const { getSigner } = await importKms();
  const signer = await getSigner("rpt");
  const encoder = new TextEncoder();
  const data = encoder.encode("hello world");
  const signature = await signer.sign(data);
  assert.equal(typeof signature, "string");
  assert.equal(typeof signer.publicKey, "string");
  assert.equal(signer.version, 1);
  assert.equal(await signer.verify(data, signature), true);
});

test("rotateKey produces new version while preserving old verification", async () => {
  const { getSigner, rotateKey, getKeyRecord } = await importKms();
  const encoder = new TextEncoder();

  const signerV1 = await getSigner("rpt");
  const messageOld = encoder.encode("initial message");
  const signatureOld = await signerV1.sign(messageOld);
  assert.equal(await signerV1.verify(messageOld, signatureOld), true);

  const rotated = await rotateKey("rpt");
  assert.equal(rotated.version, signerV1.version + 1);

  const signerV2 = await getSigner("rpt");
  const messageNew = encoder.encode("rotated message");
  const signatureNew = await signerV2.sign(messageNew);
  assert.equal(await signerV2.verify(messageNew, signatureNew), true);
  assert.equal(await signerV2.verify(messageOld, signatureOld), false);

  const oldRecord = await getKeyRecord("rpt", signerV1.version);
  assert.ok(oldRecord);
  const publicKey = createPublicKey({
    key: Buffer.from(oldRecord!.publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  const verifiedOld = verifyEd25519(null, Buffer.from(messageOld), publicKey, Buffer.from(signatureOld, "base64"));
  assert.equal(verifiedOld, true);
});

