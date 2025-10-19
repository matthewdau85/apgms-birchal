import { strict as assert } from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { canonicalize, mintRpt, verifyChain, verifyRpt } from "../services/api-gateway/src/lib/rpt.js";

test("canonicalize produces stable ordering", () => {
  const value = { b: 2, a: 1, nested: { y: 2, x: 1 } };
  const result = canonicalize(value);
  assert.equal(result, "{\"a\":1,\"b\":2,\"nested\":{\"x\":1,\"y\":2}}");
});

test("tampered payload fails verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const rpt = mintRpt({
    rptId: "rpt-1",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { amount: 100 },
    privateKey,
  });

  assert.equal(verifyRpt(rpt, publicKey), true);

  const tampered = {
    ...rpt,
    payload: { amount: 999 },
  };

  assert.equal(verifyRpt(tampered, publicKey), false);
});

test("broken prevHash fails chain verification", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const rpt1 = mintRpt({
    rptId: "rpt-2",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { step: 1 },
    privateKey,
  });
  const rpt2 = mintRpt({
    rptId: "rpt-2",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { step: 2 },
    prevHash: "invalid",
    privateKey,
  });

  assert.equal(verifyChain([rpt1, rpt2]), false);
});

test("valid chain verifies", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const rpt1 = mintRpt({
    rptId: "rpt-3",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { step: 1 },
    privateKey,
  });
  const rpt2 = mintRpt({
    rptId: "rpt-3",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { step: 2 },
    prevHash: rpt1.hash,
    privateKey,
  });
  const rpt3 = mintRpt({
    rptId: "rpt-3",
    bankLineId: "line-1",
    orgId: "org-1",
    payload: { step: 3 },
    prevHash: rpt2.hash,
    privateKey,
  });

  assert.equal(verifyChain([rpt1, rpt2, rpt3]), true);
});
