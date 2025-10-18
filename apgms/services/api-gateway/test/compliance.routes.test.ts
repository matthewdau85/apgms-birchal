import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/index";
import { resetComplianceState } from "../src/compliance";

describe("compliance routes", () => {
  const shared: { app: Awaited<ReturnType<typeof createApp>> | null } = { app: null };

  before(async () => {
    shared.app = await createApp();
  });

  after(async () => {
    if (shared.app) {
      await shared.app.close();
    }
  });

  beforeEach(() => {
    resetComplianceState();
  });

  afterEach(() => {
    resetComplianceState();
  });

  it("returns compliance obligation summaries", async () => {
    const response = await shared.app!.inject({
      method: "GET",
      url: "/compliance/obligations",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as { obligations: Array<Record<string, unknown>> };
    assert.ok(Array.isArray(payload.obligations));
    assert.equal(payload.obligations.length, 3);

    const basQ2 = payload.obligations.find((item) => item["id"] === "ob-bas-q2");
    assert.ok(basQ2, "expected BAS Q2 summary");
    assert.equal(basQ2["status"], "variance");
    assert.equal(basQ2["transfersReconciled"], true);
  });

  it("blocks BAS submission until discrepancies acknowledged", async () => {
    const firstAttempt = await shared.app!.inject({
      method: "POST",
      url: "/compliance/bas/submit",
      payload: { triggeredBy: "controller@example.com" },
    });

    assert.equal(firstAttempt.statusCode, 409);
    const blocked = firstAttempt.json() as { blockedObligations: Array<Record<string, unknown>> };
    assert.ok(Array.isArray(blocked.blockedObligations));
    assert.equal(blocked.blockedObligations.length > 0, true);
    const blockedBas = blocked.blockedObligations.find((item) => item["obligationId"] === "ob-bas-q2");
    assert.ok(blockedBas, "BAS should be blocked when discrepancy outstanding");

    const acknowledgementResponse = await shared.app!.inject({
      method: "POST",
      url: "/compliance/obligations/ob-bas-q2/discrepancy/acknowledge",
      payload: {
        acknowledgedBy: "controller@example.com",
        note: "Variance reviewed and approved for settlement",
      },
    });

    assert.equal(acknowledgementResponse.statusCode, 200);
    const acknowledgementBody = acknowledgementResponse.json() as {
      summary: Record<string, unknown>;
    };
    assert.equal(acknowledgementBody.summary["status"], "acknowledged");
    assert.equal(acknowledgementBody.summary["readyToSubmit"], true);

    const secondAttempt = await shared.app!.inject({
      method: "POST",
      url: "/compliance/bas/submit",
      payload: { triggeredBy: "controller@example.com" },
    });

    assert.equal(secondAttempt.statusCode, 202);
    const submission = secondAttempt.json() as { submission: Record<string, unknown> };
    assert.ok(submission.submission);
    const obligations = submission.submission["obligations"] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(obligations));
    const acknowledged = obligations.find((item) => item["id"] === "ob-bas-q2");
    assert.ok(acknowledged);
    assert.equal(acknowledged["status"], "acknowledged");
  });

  it("exposes designated account balances with reserves", async () => {
    const response = await shared.app!.inject({
      method: "GET",
      url: "/compliance/designated-account-balances",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as { accounts: Array<Record<string, unknown>> };
    assert.ok(Array.isArray(payload.accounts));
    const basAccount = payload.accounts.find((account) => account["accountId"] === "DA-001");
    assert.ok(basAccount, "expected BAS clearing account");
    assert.equal(typeof basAccount["reservedAmount"], "number");
    assert.equal(typeof basAccount["availableBalance"], "number");
  });
});
