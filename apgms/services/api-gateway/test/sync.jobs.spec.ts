import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockPrisma, MockPrismaClient } from "./utils/mockPrisma";

const prismaHolder: { prisma: MockPrismaClient } = { prisma: createMockPrisma() };

vi.mock("@apgms/shared/src/db", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));

import { runScheduledSync } from "../src/jobs/sync";

describe("sync jobs", () => {
  beforeEach(() => {
    prismaHolder.prisma = createMockPrisma();
    process.env.XERO_WEBHOOK_SECRET = "xero-secret";
  });

  it("runs scheduled sync and upserts normalized records", async () => {
    await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-10",
        provider: "xero",
        status: "CONNECTED",
        accessToken: "token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        meta: {},
      },
    });

    const results = await runScheduledSync();
    expect(results).toHaveLength(1);
    expect(results[0].counts.invoices).toBeGreaterThan(0);
    expect(prismaHolder.prisma.bankLine.upsert).toHaveBeenCalled();
    expect(prismaHolder.prisma.auditBlob.upsert).toHaveBeenCalled();

    const connection = Array.from(prismaHolder.prisma.__stores.connections.values())[0];
    expect(connection.meta).toMatchObject({ lastSyncReason: "schedule" });
  });
});
