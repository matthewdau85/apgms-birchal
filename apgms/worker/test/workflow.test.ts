import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorkflowOrchestrator } from "../src/index";

const baseDataset = {
  accounts: [
    {
      accountId: "acct-1",
      name: "Operating Account",
      balance: 25_000,
      currency: "AUD",
      institution: "Birchal Bank",
    },
  ],
  transactions: [
    {
      transactionId: "txn-1",
      accountId: "acct-1",
      type: "debit" as const,
      amount: 4_500,
      currency: "AUD",
      description: "Supplier Invoice 1001",
      postedAt: "2024-07-01T00:00:00.000Z",
      category: "AP",
    },
    {
      transactionId: "txn-2",
      accountId: "acct-1",
      type: "credit" as const,
      amount: 9_700,
      currency: "AUD",
      description: "Customer Remittance 5678",
      postedAt: "2024-07-02T00:00:00.000Z",
      category: "AR",
    },
  ],
  paymentsDue: [
    {
      paymentId: "pay-1",
      amount: 4_500,
      currency: "AUD",
      beneficiary: "Best Suppliers Pty Ltd",
      remittanceInformation: "Invoice 1001",
      dueDate: "2024-07-05",
    },
    {
      paymentId: "pay-2",
      amount: 1_200,
      currency: "AUD",
      beneficiary: "ATO",
      remittanceInformation: "PAYG Q4",
      dueDate: "2024-07-07",
    },
  ],
  registryInstructions: [
    {
      registry: "asic",
      changes: {
        lastLodgement: "2024-07-05",
        directors: ["Alice Birchal", "Bob Birchal"],
      },
    },
    {
      registry: "abr",
      changes: {
        gst: true,
        payrollTax: false,
      },
    },
  ],
  reportingPeriod: "2024-Q3",
};

describe("workflow orchestrator", () => {
  it("runs the end-to-end happy path", async () => {
    const orchestrator = new WorkflowOrchestrator({
      connectors: {
        connectors: {
          xero: baseDataset,
        },
      },
    });

    await orchestrator.triggerConnectorSync("org-1", "xero");

    const state = orchestrator.getState();

    assert.equal(state.ingestions.length, 1);
    assert.equal(state.payments.length, baseDataset.paymentsDue.length);
    assert.equal(state.reconciliations.length, 1);
    assert.equal(state.reports.length, 1);
    assert.ok(state.registries.asic);
    assert.ok(state.registries.abr);

    const reconciliation = state.reconciliations[0];
    assert.equal(reconciliation.summary.unmatchedPayments, 0);
    assert.equal(reconciliation.summary.settledPayments, baseDataset.paymentsDue.length);

    const telemetry = orchestrator.getTelemetrySnapshot();
    assert.equal(telemetry.counters["connectors.sync.success"], 1);
    assert.equal(telemetry.counters["payments.execute.success"], baseDataset.paymentsDue.length);

    const auditConnector = state.auditLogs.find((entry) => entry.action === "connector_sync");
    assert.ok(auditConnector);
    assert.equal(auditConnector?.status, "SUCCESS");

    const auditReconciliation = state.auditLogs.find((entry) => entry.action === "reconciliation_complete");
    assert.ok(auditReconciliation);
    assert.equal(auditReconciliation?.status, "SUCCESS");
  });

  it("records connector failures", async () => {
    const orchestrator = new WorkflowOrchestrator({
      connectors: {
        connectors: {},
      },
    });

    await orchestrator.triggerConnectorSync("org-404", "missing");

    const state = orchestrator.getState();
    assert.equal(state.ingestions.length, 0);

    const audit = state.auditLogs.find((entry) => entry.entity === "connector:missing");
    assert.ok(audit);
    assert.equal(audit?.status, "FAILURE");
    assert.equal(audit?.reason, "UNKNOWN_CONNECTOR");
  });
});
