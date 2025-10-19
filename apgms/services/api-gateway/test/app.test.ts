import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ skipLogging: true });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.bankLine.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
});

describe("GET /health", () => {
  it("returns service health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "api-gateway" });
  });
});

describe("GET /users", () => {
  it("returns users ordered by creation date", async () => {
    const org = await prisma.org.create({ data: { name: "Demo Org" } });
    await prisma.user.create({
      data: { email: "founder@example.com", password: "password123", orgId: org.id },
    });

    const res = await app.inject({ method: "GET", url: "/users" });
    expect(res.statusCode).toBe(200);

    const payload = res.json() as { users: Array<{ email: string; orgId: string }> };
    expect(payload.users).toHaveLength(1);
    expect(payload.users[0]).toMatchObject({ email: "founder@example.com", orgId: org.id });
  });
});

describe("bank line routes", () => {
  it("creates and lists bank lines", async () => {
    const org = await prisma.org.create({ data: { name: "Demo Org" } });

    const createResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: org.id,
        date: new Date("2024-01-01T00:00:00Z").toISOString(),
        amount: "1200.25",
        payee: "Investor",
        desc: "Seed round",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as { orgId: string; amount: Prisma.Decimal; payee: string };
    expect(created.orgId).toBe(org.id);
    expect(created.payee).toBe("Investor");

    const listResponse = await app.inject({ method: "GET", url: "/bank-lines?take=5" });
    expect(listResponse.statusCode).toBe(200);
    const listPayload = listResponse.json() as { lines: Array<{ amount: Prisma.Decimal; payee: string }> };
    expect(listPayload.lines).toHaveLength(1);
    expect(listPayload.lines[0].payee).toBe("Investor");
    expect(listPayload.lines[0].amount.toString()).toBe("1200.25");
  });

  it("returns 400 for invalid payloads", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "",
        date: "not-a-date",
        amount: "NaN",
        payee: "",
        desc: "",
      },
    });

    expect(res.statusCode).toBe(400);
    const payload = res.json() as { error: string; issues: unknown[] };
    expect(payload.error).toBe("bad_request");
    expect(Array.isArray(payload.issues)).toBe(true);
  });
});
