import Fastify, { type FastifyInstance } from "fastify";
import request from "supertest";

import { authPlugin } from "../src/plugins/auth";
import { orgScopeHook } from "../src/hooks/org-scope";
import { signJwt } from "../src/utils/jwt";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const TEST_SECRET = "test-secret";

const buildTestApp = async (
  registerRoutes: (app: FastifyInstance) => void,
): Promise<FastifyInstance> => {
  const app = Fastify();
  await app.register(async (instance) => {
    await authPlugin(instance);
    instance.addHook("preHandler", orgScopeHook);
    registerRoutes(instance);
  });
  await app.ready();
  return app;
};

describe("auth plugin", () => {
  const apps: FastifyInstance[] = [];

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("returns 401 when authorization header is missing", async () => {
    const app = await buildTestApp((instance) => {
      instance.get("/v1/ping", async () => ({ ok: true }));
    });
    apps.push(app);

    const response = await request(app).get("/v1/ping");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("returns 401 for an invalid token", async () => {
    const app = await buildTestApp((instance) => {
      instance.get("/v1/ping", async () => ({ ok: true }));
    });
    apps.push(app);

    const response = await request(app)
      .get("/v1/ping")
      .set("Authorization", "Bearer invalid.token.value");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("allows access with a valid token", async () => {
    const app = await buildTestApp((instance) => {
      instance.get("/v1/ping", async (req) => ({
        ok: true,
        user: (req as any).user,
        orgId: (req as any).orgId,
      }));
    });
    apps.push(app);

    const token = signJwt(
      {
        sub: "user-123",
        orgId: "org-abc",
        roles: ["admin"],
      },
      TEST_SECRET,
    );

    const response = await request(app)
      .get("/v1/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      orgId: "org-abc",
      user: { id: "user-123", orgId: "org-abc", roles: ["admin"] },
    });
  });
});
