import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createPublicKey, createSign, generateKeyPairSync, type JsonWebKey } from "node:crypto";

process.env.APGMS_FAKE_PRISMA = "1";
process.env.NODE_ENV = "test";

import type { buildApp as BuildAppFn } from "../src/index";
import type { prisma as PrismaInstance } from "../../../shared/src/db";

type PrismaModule = typeof import("../../../shared/src/db");

type PrismaUserFindMany = PrismaInstance["user"]["findMany"];
type PrismaBankLineFindMany = PrismaInstance["bankLine"]["findMany"];
type PrismaBankLineCreate = PrismaInstance["bankLine"]["create"];

type TestContext = {
  signToken: (orgId: string, roles?: string[]) => string;
  close: () => Promise<void>;
};

let prisma: PrismaInstance;
let buildApp: typeof BuildAppFn;
let originalUserFindMany: PrismaUserFindMany;
let originalBankLineFindMany: PrismaBankLineFindMany;
let originalBankLineCreate: PrismaBankLineCreate;

async function loadModules() {
  if (!prisma || !buildApp) {
    const shared = (await import("../../../shared/src/db")) as PrismaModule;
    prisma = shared.prisma as PrismaInstance;
    const gateway = await import("../src/index");
    buildApp = gateway.buildApp;
    originalUserFindMany = prisma.user.findMany;
    originalBankLineFindMany = prisma.bankLine.findMany;
    originalBankLineCreate = prisma.bankLine.create;
  }
}

async function setupAuth(): Promise<TestContext> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { format: "pem", type: "spki" },
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
  });

  const jwk = createPublicKey(publicKey).export({ format: "jwk" }) as JsonWebKey;
  jwk.kid = "test";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const server = createServer((req, res) => {
    if (req.url === "/.well-known/jwks.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const jwksUri = `http://127.0.0.1:${port}/.well-known/jwks.json`;

  process.env.OIDC_JWKS_URI = jwksUri;
  process.env.OIDC_ISSUER = "https://issuer.test";
  process.env.OIDC_AUDIENCE = "api://gateway";

  const signToken = (orgId: string, roles: string[] = []) => {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "RS256" as const,
      typ: "JWT",
      kid: "test",
    };
    const payload = {
      iss: process.env.OIDC_ISSUER,
      aud: process.env.OIDC_AUDIENCE,
      iat: now,
      exp: now + 60 * 60,
      orgId,
      roles,
    };
    const encode = (input: unknown) =>
      Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKey).toString("base64url");
    return `${signingInput}.${signature}`;
  };

  return {
    signToken,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function testUnauthorized() {
  const app = buildApp();
  await app.ready();
  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
  await app.close();
}

async function testForbidden(signToken: TestContext["signToken"]) {
  let createCalled = false;
  prisma.bankLine.create = (async () => {
    createCalled = true;
    throw new Error("should not create when org scope mismatches");
  }) as PrismaBankLineCreate;

  const token = signToken("org-one", ["finance:write"]);
  const app = buildApp();
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-two",
      date: new Date().toISOString(),
      amount: 100,
      payee: "ACME",
      desc: "mismatch",
    },
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(createCalled, false);

  await app.close();
}

async function testAuthorized(signToken: TestContext["signToken"]) {
  let receivedWhere: any;
  prisma.user.findMany = (async (args: any) => {
    receivedWhere = args?.where;
    return [
      { email: "user@example.com", orgId: "org-one", createdAt: new Date("2024-01-01T00:00:00.000Z") },
    ];
  }) as PrismaUserFindMany;
  prisma.bankLine.findMany = (async (args: any) => {
    assert.deepEqual(args?.where, { orgId: "org-one" });
    return [];
  }) as PrismaBankLineFindMany;

  const token = signToken("org-one", ["finance:read"]);
  const app = buildApp();
  await app.ready();

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedWhere, { orgId: "org-one" });

  const body = response.json();
  assert.equal(body.users.length, 1);
  assert.equal(body.users[0].email, "user@example.com");
  assert.equal(body.users[0].orgId, "org-one");

  await app.close();
}

async function main() {
  await loadModules();
  const { signToken, close } = await setupAuth();
  try {
    prisma.user.findMany = (async () => []) as PrismaUserFindMany;
    prisma.bankLine.findMany = (async () => []) as PrismaBankLineFindMany;
    prisma.bankLine.create = (async (args: any) => ({ ...args.data, id: "line_123" })) as PrismaBankLineCreate;

    await testUnauthorized();

    prisma.user.findMany = (async () => []) as PrismaUserFindMany;
    prisma.bankLine.findMany = (async () => []) as PrismaBankLineFindMany;
    prisma.bankLine.create = (async (args: any) => ({ ...args.data, id: "line_123" })) as PrismaBankLineCreate;
    await testForbidden(signToken);

    prisma.user.findMany = (async () => []) as PrismaUserFindMany;
    prisma.bankLine.findMany = (async () => []) as PrismaBankLineFindMany;
    prisma.bankLine.create = (async (args: any) => ({ ...args.data, id: "line_123" })) as PrismaBankLineCreate;
    await testAuthorized(signToken);

    console.log("authz tests passed");
  } finally {
    prisma.user.findMany = originalUserFindMany;
    prisma.bankLine.findMany = originalBankLineFindMany;
    prisma.bankLine.create = originalBankLineCreate;
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
