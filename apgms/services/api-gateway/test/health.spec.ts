import Fastify from "fastify";
import { registerHealthRoutes } from "../src/routes/health";
import type { PrismaClient } from "@prisma/client";
import { jest } from "@jest/globals";

describe("health routes", () => {
  const buildApp = (prisma: Pick<PrismaClient, "$queryRaw">) => {
    const app = Fastify();
    registerHealthRoutes(app, prisma as PrismaClient);
    return app;
  };

  it("returns ok health payload", async () => {
    const prismaMock = { $queryRaw: jest.fn() };
    const app = buildApp(prismaMock as unknown as PrismaClient);
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "api-gateway" });

    await app.close();
  });

  it("returns readiness success when db is reachable", async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };

    const app = buildApp(prismaMock as unknown as PrismaClient);
    const response = await app.inject({ method: "GET", url: "/readyz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ready: true });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("returns readiness failure when db is unreachable", async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockRejectedValue(new Error("no db")),
    };

    const app = buildApp(prismaMock as unknown as PrismaClient);
    const response = await app.inject({ method: "GET", url: "/readyz" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ready: false, reason: "db_unreachable" });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
