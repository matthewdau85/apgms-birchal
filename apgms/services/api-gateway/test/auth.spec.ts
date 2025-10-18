import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import authPlugin from "../src/plugins/auth";
import orgScopePlugin from "../src/plugins/org-scope";

type TestContext = {
  app: FastifyInstance;
};

const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify();

  await app.register(async (instance) => {
    await instance.register(authPlugin);
    await instance.register(orgScopePlugin);

    instance.get(
      "/protected",
      { preHandler: [instance.verifyBearer, instance.ensureOrgParam()] },
      async (request) => ({ user: request.user })
    );

    instance.post(
      "/protected",
      { preHandler: [instance.verifyBearer, instance.ensureOrgParam()] },
      async (request) => ({ user: request.user })
    );
  });

  return app;
};

const ctx: Partial<TestContext> = {};

beforeEach(async () => {
  process.env.AUTH_BYPASS = "true";
  process.env.AUTH_ISSUER = "test-issuer";
  process.env.AUTH_AUDIENCE = "test-audience";
  const app = await buildApp();
  ctx.app = app;
  await app.ready();
});

afterEach(async () => {
  if (ctx.app) {
    await ctx.app.close();
    delete ctx.app;
  }
  delete process.env.AUTH_BYPASS;
  delete process.env.AUTH_ISSUER;
  delete process.env.AUTH_AUDIENCE;
});

const bearer = (value: string) => `Bearer ${value}`;

const bypassToken = (userId: string, orgId: string, roles: string[]) =>
  `${userId}:${orgId}:${roles.join(",")}`;

test("401 when no authorization header is present", async () => {
  const response = await ctx.app!.inject({
    method: "GET",
    url: "/protected?orgId=org-1",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("403 when requesting data for a different organisation", async () => {
  const response = await ctx.app!.inject({
    method: "GET",
    url: "/protected?orgId=org-2",
    headers: {
      authorization: bearer(bypassToken("user-1", "org-1", ["member"])),
    },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { error: "forbidden" });
});

test("200 when the user and org scope match", async () => {
  const response = await ctx.app!.inject({
    method: "POST",
    url: "/protected",
    payload: { orgId: "org-1" },
    headers: {
      authorization: bearer(bypassToken("user-1", "org-1", ["admin", "finance"])),
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    user: {
      userId: "user-1",
      orgId: "org-1",
      roles: ["admin", "finance"],
    },
  });
});
