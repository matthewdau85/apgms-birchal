import { afterEach, describe, expect, test } from "vitest";
import { buildApp, type BuildAppOptions } from "../src/app";
import { createPrismaDouble } from "./prisma-double";

type AppInstance = Awaited<ReturnType<typeof buildApp>>;

async function createApp(overrides: Partial<BuildAppOptions> = {}): Promise<AppInstance> {
  return buildApp({
    prismaClient: createPrismaDouble(),
    bodyLimit: 1024 * 4,
    rateLimit: { max: 2, timeWindow: 1000 },
    ...overrides,
  });
}

describe("security e2e", () => {
  let app: AppInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("returns CORS headers for allowed origins", async () => {
    app = await createApp({ rateLimit: false });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/bank-lines",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://example.com");
  });

  test("enforces rate limiting with 429 responses", async () => {
    app = await createApp({ rateLimit: { max: 1, timeWindow: 1000 } });

    const first = await app.inject({ method: "GET", url: "/bank-lines" });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: "GET", url: "/bank-lines" });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ statusCode: 429, error: "Too Many Requests" });
  });

  test("rejects payloads larger than the configured limit", async () => {
    app = await createApp({ rateLimit: false, bodyLimit: 128 });

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-1",
        date: new Date().toISOString(),
        amount: 10,
        payee: "Acme",
        desc: "x".repeat(1024),
      },
    });

    expect(response.statusCode).toBe(413);
  });
});
