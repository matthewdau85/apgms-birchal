import { describe, expect, it } from "vitest";
import { createAgreement, remit } from "@apgms/payments/adapters/payto.mock";
import { listAuditBlobs } from "@apgms/shared/audit-blob";
import { setGateState } from "@apgms/shared/gates";

describe("PayTo mock adapter", () => {
  it("creates agreements with masked details", async () => {
    setGateState("org_1", "OPEN");
    const agreement = await createAgreement({
      orgId: "org_1",
      payeeName: "Alice",
      bsb: "123456",
      acc: "123456789",
    });

    expect(agreement.agreementId).toMatch(/^agt_/);
    expect(agreement.bsbMasked).toBe("****56");
    expect(agreement.accMasked.endsWith("789")).toBe(true);

    const audit = listAuditBlobs().find((blob) => blob.kind === "payto.createAgreement");
    expect(audit).toBeTruthy();
    expect(audit?.orgId).toBe("org_1");
  });

  it("remits immediately with SENT status", async () => {
    setGateState("org_2", "OPEN");
    const result = await remit({
      orgId: "org_2",
      agreementId: "agt_test",
      amountCents: 1234,
      currency: "AUD",
    });

    expect(result.status).toBe("SENT");
    expect(result.remittanceId).toMatch(/^rem_/);

    const audit = listAuditBlobs().find((blob) => blob.kind === "payto.remit");
    expect(audit).toBeTruthy();
    expect(audit?.payloadJson).toMatchObject({
      agreementId: "agt_test",
      amountCents: 1234,
      currency: "AUD",
    });
  });
});
