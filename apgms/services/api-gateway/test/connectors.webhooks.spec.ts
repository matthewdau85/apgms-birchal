import crypto from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockPrisma, MockPrismaClient } from "./utils/mockPrisma";
import { signJwt } from "../src/utils/jwt";

const prismaHolder: { prisma: MockPrismaClient } = { prisma: createMockPrisma() };

vi.mock("@apgms/shared/src/db", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));

import { buildApp } from "../src/app";

describe("connector webhooks", () => {
  beforeEach(() => {
    prismaHolder.prisma = createMockPrisma();
    process.env.SHOPIFY_WEBHOOK_SECRET = "shopify-secret";
    process.env.SQUARE_WEBHOOK_SECRET = "square-secret";
    process.env.XERO_WEBHOOK_SECRET = "xero-secret";
  });

  it("validates shopify hmac and enqueues sync", async () => {
    const app = buildApp();
    const connection = await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-5",
        provider: "shopify",
        status: "CONNECTED",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        meta: {},
      },
    });
    const payload = {
      orgId: "org-5",
      connectionId: connection.id,
      nonce: "nonce-1",
      timestamp: new Date().toISOString(),
      events: [
        { id: "evt-1", type: "payment.updated", occurredAt: new Date().toISOString() },
      ],
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(raw).digest("base64");
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": signature,
      },
      payload: raw,
    });
    expect(response.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prismaHolder.prisma.bankLine.upsert).toHaveBeenCalled();
    await app.close();
  });

  it("rejects replayed nonce", async () => {
    const app = buildApp();
    const connection = await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-6",
        provider: "shopify",
        status: "CONNECTED",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        meta: {},
      },
    });
    const payload = {
      orgId: "org-6",
      connectionId: connection.id,
      nonce: "nonce-2",
      timestamp: new Date().toISOString(),
      events: [],
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(raw).digest("base64");
    const first = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": signature,
      },
      payload: raw,
    });
    expect(first.statusCode).toBe(202);
    const second = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": signature,
      },
      payload: raw,
    });
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it("rejects stale webhook payload", async () => {
    const app = buildApp();
    await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-7",
        provider: "shopify",
        status: "CONNECTED",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        meta: {},
      },
    });
    const payload = {
      orgId: "org-7",
      nonce: "nonce-stale",
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      events: [],
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(raw).digest("base64");
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": signature,
      },
      payload: raw,
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("validates xero jwt signature", async () => {
    const app = buildApp();
    const connection = await prismaHolder.prisma.providerConnection.create({
      data: {
        orgId: "org-8",
        provider: "xero",
        status: "CONNECTED",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        meta: {},
      },
    });
    const payload = {
      orgId: "org-8",
      connectionId: connection.id,
      nonce: "jwt-nonce",
      timestamp: new Date().toISOString(),
      events: [],
    };
    const raw = JSON.stringify(payload);
    const jwt = signJwt({ orgId: "org-8", connectionId: connection.id, nonce: "jwt-nonce", exp: Math.floor(Date.now() / 1000) + 60 }, process.env.XERO_WEBHOOK_SECRET!);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/xero",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      payload: raw,
    });
    expect(response.statusCode).toBe(202);
    await app.close();
  });
});
