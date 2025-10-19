import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import authPlugin from "../src/plugins/auth";
import { orgScopeHook } from "../src/hooks/org-scope";

const buildUserHeader = (payload: Record<string, unknown>) => ({
  "x-user": JSON.stringify(payload),
});

test("authenticate attaches user context", async (t) => {
  const app = Fastify();

  await app.register(authPlugin);
  await app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);
    instance.get("/protected", async (request) => ({ user: request.user }));
  });

  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/protected",
    headers: buildUserHeader({ id: "user-1", orgIds: ["org-1"] }),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    user: { id: "user-1", orgIds: ["org-1"], activeOrgId: "org-1" },
  });
});

test("authenticate rejects missing headers", async (t) => {
  const app = Fastify();

  await app.register(authPlugin);
  await app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);
    instance.get("/protected", async () => ({ ok: true }));
  });

  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/protected" });

  assert.equal(response.statusCode, 401);
});

test("org scope hook guards org routes", async (t) => {
  const app = Fastify();

  await app.register(authPlugin);
  await app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);
    instance.addHook("preHandler", orgScopeHook);
    instance.get("/v1/orgs/:orgId/resource", async (request) => ({
      org: request.org,
      activeOrgId: request.user?.activeOrgId,
    }));
  });

  t.after(() => app.close());

  const allowed = await app.inject({
    method: "GET",
    url: "/v1/orgs/org-1/resource",
    headers: buildUserHeader({ id: "user-1", orgIds: ["org-1", "org-2"] }),
  });

  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(allowed.json(), {
    org: { id: "org-1" },
    activeOrgId: "org-1",
  });

  const forbidden = await app.inject({
    method: "GET",
    url: "/v1/orgs/org-3/resource",
    headers: buildUserHeader({ id: "user-1", orgIds: ["org-1", "org-2"] }),
  });

  assert.equal(forbidden.statusCode, 403);
});
