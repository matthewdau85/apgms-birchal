import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { mintRpt, resetRptSignerCache, verifyRpt } from "../src/lib/rpt";

type KeyEntry = {
  kid: string;
  privateKey: string;
  publicKey: string;
};

function createKey(kid: string): KeyEntry {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    kid,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

async function assertMintUsesActiveKey() {
  const primary = createKey("kid-primary");
  const secondary = createKey("kid-secondary");

  process.env.RPT_PRIVATE_KEYS = JSON.stringify([primary, secondary]);
  resetRptSignerCache();

  const token = await mintRpt(
    { sub: "user-123", scope: ["bank:read"] },
    { issuer: "api-gateway", audience: "birchal" },
  );

  const { payload, protectedHeader } = await verifyRpt(token, {
    issuer: "api-gateway",
    audience: "birchal",
  });

  assert.equal(protectedHeader.kid, primary.kid);
  assert.equal(payload.sub, "user-123");
  assert.deepEqual(payload.scope, ["bank:read"]);
}

async function assertRotationSupportsLegacyTokens() {
  const keyA = createKey("kid-a");
  const keyB = createKey("kid-b");

  process.env.RPT_PRIVATE_KEYS = JSON.stringify([keyA, keyB]);
  resetRptSignerCache();

  const legacyToken = await mintRpt({ sub: "user-456", scope: ["bank:write"] }, { issuer: "api-gateway" });

  const keyC = createKey("kid-c");
  process.env.RPT_PRIVATE_KEYS = JSON.stringify([keyC, keyA, keyB]);
  resetRptSignerCache();

  const { payload: legacyPayload, protectedHeader: legacyHeader } = await verifyRpt(legacyToken, {
    issuer: "api-gateway",
  });

  assert.equal(legacyHeader.kid, keyA.kid);
  assert.equal(legacyPayload.sub, "user-456");

  const rotatedToken = await mintRpt({ sub: "user-456", scope: ["bank:approve"] }, { issuer: "api-gateway" });
  const { protectedHeader: rotatedHeader } = await verifyRpt(rotatedToken, { issuer: "api-gateway" });

  assert.equal(rotatedHeader.kid, keyC.kid);
}

async function run() {
  await assertMintUsesActiveKey();
  await assertRotationSupportsLegacyTokens();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
