import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import {
  AuthGuardError,
  parseAuthContext,
  registerAuthGuard,
} from "../../services/api-gateway/src/auth/auth.guard.ts";

const setupModule = await import("../../scripts/test-setup.ts");
const setupFn =
  typeof setupModule.default === "function"
    ? setupModule.default
    : setupModule.default.default;
await setupFn();

test("auth guard parses authentication headers", () => {
  const request = {
    headers: { "x-org-id": "org-123", "x-user-id": "user-456" },
  } as FastifyRequest;

  assert.deepStrictEqual(parseAuthContext(request), {
    orgId: "org-123",
    userId: "user-456",
  });
});

test("auth guard throws when required headers are missing", () => {
  const request = { headers: {} } as FastifyRequest;
  assert.throws(() => parseAuthContext(request), AuthGuardError);
});

test("auth guard decorates requests and enforces authentication", async () => {
  const app = Fastify({ logger: false });
  await registerAuthGuard(app);

  app.get("/secure", async (request) => request.authContext);
  app.get(
    "/public",
    { config: { auth: false } },
    async (request) => request.authContext
  );

  await app.ready();

  const secureResponse = await app.inject({
    method: "GET",
    url: "/secure",
    headers: {
      "x-org-id": "org-1",
      "x-user-id": "user-1",
    },
  });

  assert.equal(secureResponse.statusCode, 200, secureResponse.payload);
  assert.deepStrictEqual(secureResponse.json(), { orgId: "org-1", userId: "user-1" });

  const unauthorized = await app.inject({ method: "GET", url: "/secure" });
  assert.equal(unauthorized.statusCode, 401);

  const publicRoute = await app.inject({ method: "GET", url: "/public" });
  assert.equal(publicRoute.statusCode, 200);
  assert.equal(publicRoute.payload, "null");

  await app.close();
});
