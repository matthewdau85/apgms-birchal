import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";

const { prisma } = await import("@apgms/shared/db");
const { applyPolicy } = await import("@apgms/shared/policy-engine");
const { clearRptStore, mintRpt, saveRptToken, verifyChain, verifyRpt } = await import("../src/lib/rpt.js");
const { buildApp } = await import("../src/app.js");

async function resetState() {
  prisma._$reset();
  clearRptStore();
}

async function createOrgAndBankLine(amount = 100) {
  const org = await prisma.org.create({
    data: {
      id: randomUUID(),
      name: "Acme Org",
    },
  });
  const bankLine = await prisma.bankLine.create({
    data: {
      id: randomUUID(),
      orgId: org.id,
      date: new Date("2024-01-01T00:00:00Z"),
      amount,
      payee: "Sample Vendor",
      desc: "Test Expense",
    },
  });
  return { org, bankLine };
}

beforeEach(async () => {
  await resetState();
});

after(async () => {
  await resetState();
});

function preparePolicyInput(orgId: string, bankLine: { id: string; amount: number; payee: string; desc: string; date: Date }) {
  return {
    orgId,
    bankLine: {
      id: bankLine.id,
      amount: bankLine.amount,
      payee: bankLine.payee,
      desc: bankLine.desc,
      date: bankLine.date,
    },
  };
}

test("mintRpt and verifyRpt succeed for valid payload", async () => {
  const { org, bankLine } = await createOrgAndBankLine(250);
  const policy = applyPolicy(preparePolicyInput(org.id, bankLine));
  const token = mintRpt({
    orgId: org.id,
    bankLineId: bankLine.id,
    policyHash: policy.policyHash,
    allocations: policy.allocations,
    prevHash: null,
    now: new Date("2024-02-01T00:00:00Z"),
  });

  const verification = verifyRpt(token);
  assert.equal(verification.valid, true);
});

test("tampering with payload invalidates signature", async () => {
  const { org, bankLine } = await createOrgAndBankLine(400);
  const policy = applyPolicy(preparePolicyInput(org.id, bankLine));
  const token = mintRpt({
    orgId: org.id,
    bankLineId: bankLine.id,
    policyHash: policy.policyHash,
    allocations: policy.allocations,
    prevHash: null,
    now: new Date("2024-03-01T00:00:00Z"),
  });

  const tampered = {
    ...token,
    payload: {
      ...token.payload,
      policyHash: token.payload.policyHash + "-tampered",
    },
  };

  const verification = verifyRpt(tampered);
  assert.equal(verification.valid, false);
  assert.equal(verification.reason, "hash_mismatch");
});

test("verifyChain detects incorrect prevHash", async () => {
  const { org, bankLine } = await createOrgAndBankLine(150);
  const policy = applyPolicy(preparePolicyInput(org.id, bankLine));
  const tokenA = mintRpt({
    orgId: org.id,
    bankLineId: bankLine.id,
    policyHash: policy.policyHash,
    allocations: policy.allocations,
    prevHash: null,
    now: new Date("2024-04-01T00:00:00Z"),
  });
  await saveRptToken(null, tokenA);

  const tokenB = mintRpt({
    orgId: org.id,
    bankLineId: bankLine.id,
    policyHash: policy.policyHash,
    allocations: policy.allocations,
    prevHash: tokenA.hash,
    now: new Date("2024-04-02T00:00:00Z"),
  });
  await saveRptToken(null, tokenB);

  const validChain = await verifyChain(null, tokenB.id);
  assert.equal(validChain.valid, true);
  assert.equal(validChain.depth, 2);

  const tokenBroken = mintRpt({
    orgId: org.id,
    bankLineId: bankLine.id,
    policyHash: policy.policyHash,
    allocations: policy.allocations,
    prevHash: "not-real",
    now: new Date("2024-04-03T00:00:00Z"),
  });
  await saveRptToken(null, tokenBroken);

  const brokenChain = await verifyChain(null, tokenBroken.id);
  assert.equal(brokenChain.valid, false);
  assert.equal(brokenChain.reason, "prev_missing");
});

test("audit endpoint reports verification state", async () => {
  const { org, bankLine } = await createOrgAndBankLine(325);
  const app = await buildApp({ logger: false });

  const applyResponse = await app.inject({
    method: "POST",
    url: "/allocations/apply",
    payload: {
      orgId: org.id,
      bankLineId: bankLine.id,
      now: "2024-05-01T00:00:00.000Z",
    },
  });

  assert.equal(applyResponse.statusCode, 201);
  const applyBody = JSON.parse(applyResponse.body);
  assert.equal(applyBody.chain.valid, true);
  assert.ok(applyBody.rptToken?.id);

  const auditResponse = await app.inject({
    method: "GET",
    url: `/audit/rpt/${applyBody.rptToken.id}`,
  });

  assert.equal(auditResponse.statusCode, 200);
  const auditBody = JSON.parse(auditResponse.body);
  assert.equal(auditBody.status, "valid");
  assert.equal(auditBody.verification.valid, true);

  await app.close();
});

