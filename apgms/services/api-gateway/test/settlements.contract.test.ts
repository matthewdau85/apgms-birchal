import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../../../shared/src/db";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settlement contract endpoints", () => {
  it("returns designated accounts", async () => {
    vi.spyOn(prisma.designatedAccount, "findMany").mockResolvedValue([
      {
        id: "acct",
        orgId: "demo-org",
        label: "Primary",
        accountNo: "12345678",
        bankName: "Birchal Bank",
        currency: "AUD",
        status: "ACTIVE",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      } as any,
    ]);

    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/designated-accounts" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accounts: [
        expect.objectContaining({
          id: "acct",
          accountNo: "12345678",
          status: "ACTIVE",
        }),
      ],
    });
    await app.close();
  });

  it("returns settlement instruction discrepancies", async () => {
    vi.spyOn(prisma.settlementInstruction, "findMany").mockResolvedValue([
      {
        id: "instr",
        orgId: "demo-org",
        designatedAccountId: "acct",
        counterparty: "Birchal Nominees",
        amount: 4200 as any,
        currency: "AUD",
        dueDate: new Date("2024-01-03T00:00:00Z"),
        status: "PENDING",
        instructionRef: "SI-0001",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      } as any,
    ]);

    vi.spyOn(prisma.discrepancyEvent, "findMany").mockResolvedValue([
      {
        id: "disc",
        orgId: "demo-org",
        instructionId: "instr",
        description: "Delayed",
        severity: "MEDIUM",
        detectedAt: new Date("2024-01-02T00:00:00Z"),
        resolvedAt: null,
        resolutionNote: null,
      } as any,
    ]);

    const app = await createApp();

    const instructionsResponse = await app.inject({
      method: "GET",
      url: "/settlement-instructions",
    });
    expect(instructionsResponse.statusCode).toBe(200);
    expect(instructionsResponse.json()).toEqual({
      instructions: [
        expect.objectContaining({
          instructionRef: "SI-0001",
          status: "PENDING",
        }),
      ],
    });

    const discrepancyResponse = await app.inject({
      method: "GET",
      url: "/discrepancy-events",
    });
    expect(discrepancyResponse.statusCode).toBe(200);
    expect(discrepancyResponse.json()).toEqual({
      discrepancies: [
        expect.objectContaining({
          description: "Delayed",
          severity: "MEDIUM",
        }),
      ],
    });

    await app.close();
  });
});
