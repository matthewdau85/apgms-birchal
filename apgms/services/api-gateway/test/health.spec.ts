import Fastify from "fastify";
import { healthRoutes } from "../src/routes/health.js";

describe("health routes", () => {
  const prisma = {
    $queryRaw: jest.fn(async () => undefined),
  };

  const buildApp = async () => {
    const app = Fastify();
    await app.register(healthRoutes({ prisma }));
    await app.ready();
    return app;
  };

  afterEach(() => {
    prisma.$queryRaw.mockReset();
  });

  it("returns ok for /healthz", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/healthz" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await app.close();
    }
  });

  it("reports ready when the database ping succeeds", async () => {
    prisma.$queryRaw.mockResolvedValueOnce(1);
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/readyz" });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ready" });
    } finally {
      await app.close();
    }
  });

  it("returns a 503 when the database ping fails", async () => {
    const error = new Error("database down");
    prisma.$queryRaw.mockRejectedValueOnce(error);
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/readyz" });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: "unhealthy", reason: error.message });
    } finally {
      await app.close();
    }
  });
});
