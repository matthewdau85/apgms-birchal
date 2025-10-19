import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildApp, type BuildAppOptions } from "../src/app";
import { createPrismaDouble } from "./prisma-double";

const baseOptions: Omit<BuildAppOptions, "prismaClient"> = {
  rateLimit: false,
  bodyLimit: 1024 * 16,
};

describe("api gateway smoke", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let prisma = createPrismaDouble();

  beforeEach(async () => {
    prisma = createPrismaDouble();
    app = await buildApp({ ...baseOptions, prismaClient: prisma });
  });

  afterEach(async () => {
    await app.close();
  });

  test("GET /livez responds with 200", async () => {
    const response = await app.inject({ method: "GET", url: "/livez" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ status: "ok" });
  });

  test("auth happy path for creating and listing bank lines", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        authorization: "Bearer test-token",
      },
      payload: {
        orgId: "org-1",
        date: new Date("2024-01-01").toISOString(),
        amount: 199.99,
        payee: "Acme Corp",
        desc: "Invoice payment",
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: "GET",
      url: "/bank-lines",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(listResponse.statusCode).toBe(200);
    const payload = listResponse.json();
    expect(Array.isArray(payload.lines)).toBe(true);
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0]).toMatchObject({
      orgId: "org-1",
      payee: "Acme Corp",
      desc: "Invoice payment",
    });
  });
});
