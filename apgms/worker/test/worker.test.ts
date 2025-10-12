import { describe, expect, it, vi } from "vitest";
import type { WorkflowTask } from "../src";
import { WorkflowWorker } from "../src";

function createWorkflow(): WorkflowWorker {
  const now = vi.fn(() => new Date("2024-08-01T00:00:00.000Z"));
  return new WorkflowWorker(now);
}

describe("WorkflowWorker", () => {
  it("executes the full workflow in sequence", async () => {
    const worker = createWorkflow();
    const sequence: WorkflowTask[] = [
      {
        type: "onboarding",
        payload: {
          legalName: "Birchal Trading Pty Ltd",
          abn: "98765432109",
          contacts: [{ name: "Morgan", email: "morgan@example.com" }]
        }
      },
      {
        type: "bas",
        payload: [
          { id: "s-1", type: "sale", amount: 100, taxRate: 0.1 },
          { id: "p-1", type: "expense", amount: 40, taxRate: 0.1 }
        ]
      },
      {
        type: "recon",
        payload: {
          records: [
            { reference: "r-1", amount: 100 },
            { reference: "r-2", amount: 40 }
          ]
        }
      },
      {
        type: "debit",
        payload: { accountBalance: 200 }
      },
      {
        type: "mint",
        payload: { author: "morgan@example.com" }
      }
    ];

    let snapshot;
    for (const task of sequence) {
      snapshot = await worker.handle(task);
    }

    expect(snapshot).toBeDefined();
    expect(snapshot?.profile?.legalName).toBe("Birchal Trading Pty Ltd");
    expect(snapshot?.draft?.netPayable).toBeGreaterThan(0);
    expect(snapshot?.reconciliation?.matchRate).toBe(1);
    expect(snapshot?.debit?.status).toBe("scheduled");
    expect(snapshot?.report?.author).toBe("morgan@example.com");
  });

  it("guards against invalid task ordering", async () => {
    const worker = createWorkflow();

    await expect(() => worker.handle({ type: "bas", payload: [] })).rejects.toThrow(/Onboarding/);

    await worker.handle({
      type: "onboarding",
      payload: {
        legalName: "Birchal Trading Pty Ltd",
        abn: "98765432109",
        contacts: [{ name: "Morgan", email: "morgan@example.com" }]
      }
    });

    await expect(() => worker.handle({ type: "recon", payload: { records: [] } })).rejects.toThrow(/BAS draft/);

    await worker.handle({
      type: "bas",
      payload: [{ id: "s-1", type: "sale", amount: 50, taxRate: 0.1 }]
    });

    await expect(() => worker.handle({ type: "mint", payload: { author: "author" } })).rejects.toThrow(/debit/);
  });
});
