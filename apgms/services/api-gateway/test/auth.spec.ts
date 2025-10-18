import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildApp } from "../src/index.js";

const ORIGINAL_ENV = { ...process.env };

function createPrismaMock() {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({ id: "bank-line" }),
    },
  };
}

function createToken(claims: { sub: string; orgId: string; roles?: unknown }) {
  const secret = process.env.AUTH_SECRET ?? "";
  const issuer = process.env.AUTH_ISSUER ?? "issuer";
  const audience = process.env.AUTH_AUDIENCE ?? "audience";
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: issuer,
    aud: audience,
    exp: now + 300,
    sub: claims.sub,
    orgId: claims.orgId,
    roles: claims.roles ?? [],
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

describe("auth and org scope", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.AUTH_SECRET = "secret";
    process.env.AUTH_ISSUER = "https://issuer";
    process.env.AUTH_AUDIENCE = "api://aud";
    process.env.AUTH_BYPASS = "false";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("responds 401 when no credentials provided", async () => {
    const prismaMock = createPrismaMock();
    const app = await buildApp({ prisma: prismaMock });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/users?orgId=org-1",
    });

    assert.equal(response.statusCode, 401);
    await app.close();
  });

  it("allows bypass mode with dev headers", async () => {
    process.env.AUTH_BYPASS = "true";
    const prismaMock = createPrismaMock();
    const app = await buildApp({ prisma: prismaMock });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/users?orgId=org-1",
      headers: {
        "x-dev-user": "user-1",
        "x-dev-org": "org-1",
        "x-dev-roles": "admin",
      },
    });

    assert.equal(response.statusCode, 200);
    await app.close();
  });

  it("forbids access when org scope mismatches", async () => {
    const prismaMock = createPrismaMock();
    const token = createToken({ sub: "user-1", orgId: "org-1", roles: ["member"] });
    const app = await buildApp({ prisma: prismaMock });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines?orgId=org-2",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 403);
    await app.close();
  });

  it("allows access when org scope matches", async () => {
    const prismaMock = createPrismaMock();
    const token = createToken({ sub: "user-1", orgId: "org-1", roles: ["member"] });
    const app = await buildApp({ prisma: prismaMock });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines?orgId=org-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    await app.close();
  });
});
