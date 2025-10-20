import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decodeRpt,
  getRptKeyPair,
  signRpt,
  verifyRpt,
} from "../../security/rpt";
import { issueRptToken } from "../../server/handlers/tokens";
import { serverConfig } from "../../server/config";

const toBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const fromBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padding), "base64");
};

describe("RPT utilities", () => {
  it("signs and verifies tokens using the generated key pair", () => {
    const issued = signRpt({
      sub: "org-123",
      scopes: ["recon:read"],
      iat: Math.floor(Date.now() / 1000),
      context: { reconciliationId: "rec-1" },
    });

    assert.ok(issued.token.length > 0);

    const verification = verifyRpt(issued.token);
    assert.equal(verification.valid, true);
    assert.ok(verification.payload);
    assert.equal(verification?.payload?.sub, "org-123");
    assert.deepEqual(verification?.payload?.scopes, ["recon:read"]);

    const tamperedParts = issued.token.split(".");
    const payload = JSON.parse(fromBase64Url(tamperedParts[1]).toString("utf8"));
    payload.scopes = ["recon:write"];
    const tamperedPayload = toBase64Url(JSON.stringify(payload));
    const tamperedToken = `${tamperedParts[0]}.${tamperedPayload}.${tamperedParts[2]}`;
    const tamperedVerification = verifyRpt(tamperedToken);
    assert.equal(tamperedVerification.valid, false);
    assert.equal(tamperedVerification.error, "invalid_signature");
  });

  it("issues tokens via the handler using the persisted public key", () => {
    const now = Date.now();
    const issued = issueRptToken({
      subject: "user-42",
      scopes: ["payments:sync"],
      context: { orgId: "org-xyz" },
      expiresInSeconds: 60,
      now,
    });

    assert.equal(issued.publicKey, serverConfig.security.rpt.publicKey);

    const decoded = decodeRpt(issued.token);
    assert.equal(decoded.header.kid, serverConfig.security.rpt.keyId);

    const verification = verifyRpt(issued.token, {
      publicKey: issued.publicKey,
      now,
      maxClockSkewSeconds: 5,
    });

    assert.equal(verification.valid, true);
    assert.deepEqual(verification.payload?.scopes, ["payments:sync"]);
    assert.equal(verification.payload?.sub, "user-42");

    const keyPair = getRptKeyPair();
    assert.equal(keyPair.publicKey, issued.publicKey);
  });
});
