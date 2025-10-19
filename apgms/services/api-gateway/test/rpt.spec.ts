import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listKeys, rotateKey } from "../src/lib/kms.js";
import { mintRpt, verifyChain, verifyRpt, RptError } from "../src/lib/rpt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, "../artifacts/kms");

beforeEach(async () => {
  await fs.mkdir(artifactsDir, { recursive: true });
  const entries = await fs.readdir(artifactsDir);
  await Promise.all(
    entries
      .filter((entry) => entry !== ".gitignore")
      .map((entry) => fs.rm(path.join(artifactsDir, entry), { recursive: true, force: true })),
  );
});

afterEach(async () => {
  const entries = await fs.readdir(artifactsDir);
  await Promise.all(
    entries
      .filter((entry) => entry !== ".gitignore")
      .map((entry) => fs.rm(path.join(artifactsDir, entry), { recursive: true, force: true })),
  );
});

test("mints and verifies an RPT chain", async () => {
  const firstToken = await mintRpt({ subject: "user:123", actions: ["read"] });
  const firstVerified = await verifyRpt(firstToken);
  assert.equal(firstVerified.payload.subject, "user:123");
  assert.deepEqual(firstVerified.payload.actions, ["read"]);

  const secondToken = await mintRpt({
    subject: "user:123",
    actions: ["write"],
    previousToken: firstToken,
  });

  const chain = await verifyChain([firstToken, secondToken]);
  assert.equal(chain.length, 2);
  assert.equal(chain[1].payload.previousHash, chain[0].payload.chainHash);
});

test("rejects tampered tokens", async () => {
  const token = await mintRpt({ subject: "user:999", actions: ["read"] });
  const [header, payload, signature] = token.split(".");
  const payloadJson = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  payloadJson.actions = ["write"];
  const tampered = [
    header,
    Buffer.from(JSON.stringify(payloadJson)).toString("base64url"),
    signature,
  ].join(".");

  await assert.rejects(verifyRpt(tampered), (error) => {
    assert.ok(error instanceof RptError);
    assert.equal(error.code, "INVALID_SIGNATURE");
    return true;
  });
});

test("detects chain breaks", async () => {
  const first = await mintRpt({ subject: "acct:1", actions: ["read"] });
  const second = await mintRpt({ subject: "acct:1", actions: ["write"], previousToken: first });
  const third = await mintRpt({ subject: "acct:1", actions: ["approve"], previousToken: second });

  await assert.rejects(verifyChain([first, third]), (error) => {
    assert.ok(error instanceof RptError);
    assert.equal(error.code, "CHAIN_MISMATCH");
    return true;
  });
});

test("supports key rotation", async () => {
  const first = await mintRpt({ subject: "acct:2", actions: ["read"] });
  const firstVerified = await verifyRpt(first);

  await rotateKey();

  const second = await mintRpt({
    subject: "acct:2",
    actions: ["write"],
    previousToken: first,
  });
  const secondVerified = await verifyRpt(second);

  assert.notEqual(secondVerified.header.kid, firstVerified.header.kid);
  assert.equal(secondVerified.payload.previousHash, firstVerified.payload.chainHash);

  const chain = await verifyChain([first, second]);
  assert.equal(chain.length, 2);

  const keys = await listKeys();
  assert.equal(keys.length, 2);
});
