import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockPrisma, MockPrismaClient } from "./utils/mockPrisma";

const prismaHolder: { prisma: MockPrismaClient } = { prisma: createMockPrisma() };

vi.mock("@apgms/shared/src/db", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));

import { buildApp } from "../src/app";
import { connectors } from "../src/connectors";
import { ensureFreshAccessToken } from "../src/jobs/sync";

describe("connector oauth routes", () => {
  beforeEach(() => {
    prismaHolder.prisma = createMockPrisma();
  });

  afterEach(async () => {
    await prismaHolder.prisma?.providerConnection?.findMany({});
  });

  it("starts oauth flow and stores pending connection", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/connect/xero/start",
      query: { orgId: "org-1", redirectUri: "https://example.com/callback" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { state: string; redirectUrl: string; connectionId: string };
    expect(body.state).toHaveLength(32);
    expect(body.redirectUrl).toContain("state=");
    const connection = prismaHolder.prisma.__stores.connections.get(body.connectionId);
    expect(connection?.status).toBe("PENDING");
    expect(connection?.meta).toMatchObject({ oauthState: body.state });
    await app.close();
  });

  it("completes oauth callback and persists tokens", async () => {
    const app = buildApp();
    const start = await app.inject({
      method: "GET",
      url: "/connect/xero/start",
      query: { orgId: "org-2", redirectUri: "https://example.com/callback" },
    });
    const { state, connectionId } = start.json() as { state: string; connectionId: string };
    const callback = await app.inject({
      method: "GET",
      url: "/connect/xero/callback",
      query: { orgId: "org-2", code: "auth-code", state },
    });
    expect(callback.statusCode).toBe(200);
    const updated = prismaHolder.prisma.__stores.connections.get(connectionId);
    expect(updated?.status).toBe("CONNECTED");
    expect(updated?.accessToken).toBeTruthy();
    expect(updated?.refreshToken).toBeTruthy();
    await app.close();
  });

  it("rejects oauth callback when state mismatches", async () => {
    const app = buildApp();
    await app.inject({
      method: "GET",
      url: "/connect/xero/start",
      query: { orgId: "org-3", redirectUri: "https://example.com/callback" },
    });
    const callback = await app.inject({
      method: "GET",
      url: "/connect/xero/callback",
      query: { orgId: "org-3", code: "auth-code", state: "bad-state" },
    });
    expect(callback.statusCode).toBe(400);
    await app.close();
  });

  it("refreshes access tokens when expiring", async () => {
    prismaHolder.prisma = createMockPrisma();
    const connection = await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-4",
        provider: "xero",
        status: "CONNECTED",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 1000),
        meta: {},
      },
    });
    expect(prismaHolder.prisma.providerConnection.update).not.toHaveBeenCalled();
    const result = await ensureFreshAccessToken(connection as any, connectors.xero);
    expect(result.accessToken).not.toBe("old-token");
    expect(prismaHolder.prisma.providerConnection.update).toHaveBeenCalledTimes(1);
  });
});
