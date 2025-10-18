import { afterAll, afterEach, beforeEach, describe, expect, test } from "../../../scripts/testing";
import { createApp } from "../src/app";
import { InMemoryDatabase } from "./test-database";

const db = new InMemoryDatabase();

describe("api-gateway integration", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let orgId: string;

  beforeEach(async () => {
    db.reset();
    const org = db.seedOrg("Acme", new Date("2024-01-01T00:00:00Z"));
    orgId = org.id;
    db.seedUser({
      email: "zoe@example.com",
      orgId,
      createdAt: new Date("2024-01-05T10:00:00Z"),
    });
    db.seedUser({
      email: "amy@example.com",
      orgId,
      createdAt: new Date("2024-01-10T10:00:00Z"),
    });
    db.seedBankLine({
      orgId,
      date: new Date("2024-02-01T00:00:00Z"),
      amount: 1250.5,
      payee: "Electric Co",
      desc: "invoice",
    });
    db.seedBankLine({
      orgId,
      date: new Date("2024-02-05T00:00:00Z"),
      amount: -210.75,
      payee: "Coffee Shop",
      desc: "team event",
    });
    app = await createApp({ prisma: db, logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  test("health endpoint reports status", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "api-gateway" });
  });

  test("lists newest users first", async () => {
    const response = await app.inject({ method: "GET", url: "/users" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.users).toHaveLength(2);
    expect(payload.users[0]).toMatchObject({
      email: "amy@example.com",
    });
    expect(payload.users[1]).toMatchObject({
      email: "zoe@example.com",
    });
  });

  test("creates a bank line and respects pagination", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId,
        date: "2024-02-10T00:00:00.000Z",
        amount: 512.25,
        payee: "SaaS",
        desc: "subscription",
      },
    });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({ method: "GET", url: "/bank-lines?take=2" });
    expect(listResponse.statusCode).toBe(200);
    const payload = listResponse.json();
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0]).toMatchObject({ payee: "SaaS" });
  });
});
