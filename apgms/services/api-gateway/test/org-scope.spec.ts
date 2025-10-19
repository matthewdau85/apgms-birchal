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

describe("org scope hook", () => {
  const apps: FastifyInstance[] = [];

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("rejects cross-organisation access", async () => {
    const app = await buildTestApp((instance) => {
      instance.get("/v1/orgs/:orgId/resource", async () => ({ ok: true }));
    });
    apps.push(app);

    const token = signJwt(
      {
        sub: "user-123",
        orgId: "org-abc",
      },
      TEST_SECRET,
    );

    const response = await request(app)
      .get("/v1/orgs/org-def/resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "FORBIDDEN" });
  });
});
