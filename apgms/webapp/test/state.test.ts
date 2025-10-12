import { describe, expect, it, vi } from "vitest";
import { createFlowController } from "../src/state";

describe("createFlowController", () => {
  it("progresses through each workflow step", () => {
    const now = vi.fn(() => new Date("2024-09-01T00:00:00.000Z"));
    const controller = createFlowController(now);

    controller.startOnboarding({
      legalName: "Birchal Ventures Pty Ltd",
      abn: "13579135791",
      contacts: [{ name: "Ash", email: "ash@example.com" }]
    });
    expect(controller.state.profile?.legalName).toBe("Birchal Ventures Pty Ltd");
    expect(controller.state.step).toBe("bas");

    controller.generateBas([
      { id: "s-1", type: "sale", amount: 400, taxRate: 0.1 },
      { id: "e-1", type: "expense", amount: 200, taxRate: 0.1 }
    ]);
    expect(controller.state.draft?.netPayable).toBeGreaterThan(0);
    expect(controller.state.step).toBe("recon");

    controller.reconcile(
      [
        { reference: "r-1", amount: 400 },
        { reference: "r-2", amount: 200 }
      ],
      0.5
    );
    expect(controller.state.reconciliation?.matchRate).toBeCloseTo(1);
    expect(controller.state.step).toBe("debit");

    controller.requestDebit(1000);
    expect(controller.state.debit?.status).toBe("scheduled");
    expect(controller.state.step).toBe("report");

    controller.mintReport("ash@example.com");
    expect(controller.state.report?.author).toBe("ash@example.com");
    expect(controller.state.report?.hash).toHaveLength(64);
  });

  it("guards against invalid ordering and failed debit", () => {
    const controller = createFlowController();

    expect(() => controller.generateBas([])).toThrow(/onboard/);

    controller.startOnboarding({
      legalName: "Birchal Ventures Pty Ltd",
      abn: "13579135791",
      contacts: [{ name: "Ash", email: "ash@example.com" }]
    });

    controller.generateBas([{ id: "s-1", type: "sale", amount: 100, taxRate: 0.1 }]);

    expect(() => controller.requestDebit(1000)).toThrow(/Reconciliation/);

    controller.reconcile([{ reference: "r-1", amount: 100 }]);

    controller.requestDebit(10);
    expect(controller.state.debit?.status).toBe("insufficient_funds");
    expect(() => controller.mintReport("ash@example.com")).toThrow(/debit/);
  });
});
