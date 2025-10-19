import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import registerAdminRoutes from "../services/api-gateway/src/routes/admin/index.js";

const ISSUER = "https://idp.example.com/tenant";
const AUDIENCE = "https://api.apgms.local/admin";

process.env.JWT_SECRET = "test-secret";
process.env.OIDC_ISSUER = ISSUER;
process.env.OIDC_AUDIENCE = AUDIENCE;

function toBase64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function signToken(claims?: { amr?: string[]; acr?: string }) {
  const header = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    org: "org-123",
    email: "admin@example.com",
    sub: "user-123",
    iss: ISSUER,
    aud: AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + 300,
    ...(claims?.amr ? { amr: claims.amr } : {}),
    ...(claims?.acr ? { acr: claims.acr } : {}),
  };

  const headerSegment = toBase64Url(header);
  const payloadSegment = toBase64Url(payload);
  const input = `${headerSegment}.${payloadSegment}`;
  const signature = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(input).digest("base64url");
  return `${input}.${signature}`;
}

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(registerAdminRoutes);
  return app;
}

test("/admin/keys rejects tokens without MFA", async (t) => {
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  await app.ready();

  const token = signToken({ amr: ["pwd"] });

  const response = await app.inject({
    method: "GET",
    url: "/admin/keys",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.error, "mfa_required");
});

test("/admin/keys allows tokens with MFA claims", async (t) => {
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  await app.ready();

  const token = signToken({ amr: ["pwd", "mfa"], acr: "urn:mfa" });

  const response = await app.inject({
    method: "GET",
    url: "/admin/keys",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body, {
    keys: [],
    message: "admin_mfa_required",
  });
});
