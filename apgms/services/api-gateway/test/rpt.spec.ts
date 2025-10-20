import test from "node:test";
import assert from "node:assert/strict";
import { mint, verify, verifyChain } from "@apgms/rpt";

const basePayload = {
  rptVersion: 1,
  orgId: "org-0001",
  accountId: "acct-0001",
  amountCents: 125_000,
  currency: "AUD",
  issuedAt: new Date(2024, 0, 1).toISOString(),
};

test("minted RPT verifies successfully", () => {
  const rpt = mint({
    payload: basePayload,
    prevHash: "",
  });

  assert.equal(verify(rpt), true);
});

test("tampered RPT fails verification", () => {
  const rpt = mint({
    payload: basePayload,
    prevHash: "",
  });

  const tampered = {
    ...rpt,
    payload: {
      ...rpt.payload,
      amountCents: rpt.payload.amountCents + 1,
    },
  };

  assert.equal(verify(tampered), false);
});

test("chain verification passes and fails when link is broken", () => {
  const rpt1 = mint({
    payload: { ...basePayload, chainId: "rpt-1" },
    prevHash: "",
  });

  const rpt2 = mint({
    payload: { ...basePayload, chainId: "rpt-2" },
    prevHash: rpt1.hash,
  });

  const rpt3 = mint({
    payload: { ...basePayload, chainId: "rpt-3" },
    prevHash: rpt2.hash,
  });

  assert.equal(verifyChain([rpt1, rpt2, rpt3]), true);

  const broken = { ...rpt2, prevHash: "broken-link" };

  assert.equal(verifyChain([rpt1, broken, rpt3]), false);
});
