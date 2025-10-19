import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import authPlugin from "../../../../services/api-gateway/src/plugins/auth";
import orgScopePlugin from "../../../../services/api-gateway/src/plugins/org-scope";
import rbacPlugin from "../../../../services/api-gateway/src/plugins/rbac";

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const createHs256Token = (payload: Record<string, unknown>, secret: string) => {
  const header = { alg: "HS256", typ: "JWT" };
  const headerSegment = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadSegment = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const signatureSegment = base64UrlEncode(signature);
  return `${signingInput}.${signatureSegment}`;
};

const buildApp = async () => {
  const app = Fastify();
  await app.register(authPlugin);
  await app.register(orgScopePlugin);
  await app.register(rbacPlugin);
  app.addHook("onRequest", async (req, reply) => {
    await app.verifyAuthorization(req, reply);
  });
  app.get("/secure", async (req) => ({
    user: req.user,
    orgId: req.orgId,
  }));
  return app;
};

const withTestEnv = async (fn: () => Promise<void>) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.DEV_JWT_SECRET;
  try {
    process.env.NODE_ENV = "test";
    process.env.DEV_JWT_SECRET = "test-secret";
    await fn();
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalSecret === undefined) {
      delete process.env.DEV_JWT_SECRET;
    } else {
      process.env.DEV_JWT_SECRET = originalSecret;
    }
  }
};

test("auth plugin", async (t) => {
  await t.test("returns 401 when no authorization header", async () => {
    await withTestEnv(async () => {
      const app = await buildApp();
      const response = await app.inject({ method: "GET", url: "/secure" });
      assert.equal(response.statusCode, 401);
      await app.close();
    });
  });

  await t.test("authenticates valid bearer token", async () => {
    await withTestEnv(async () => {
      const app = await buildApp();
      const token = createHs256Token(
        {
          sub: "user-123",
          email: "user@example.com",
          orgId: "org-123",
          roles: ["member"],
        },
        "test-secret",
      );

      const response = await app.inject({
        method: "GET",
        url: "/secure",
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { orgId: string; user: { roles: string[] } };
      assert.equal(body.orgId, "org-123");
      assert.ok(body.user.roles.includes("member"));
      await app.close();
    });
  });
});
