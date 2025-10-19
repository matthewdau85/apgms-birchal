import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Fastify from "fastify";
import { registerPrivacyRoutes, type PrivacyRouteDeps } from "../src/routes/privacy";

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), "privacy-artifacts-"));
}

test("POST /admin/privacy/export writes artifact", async (t) => {
  const app = Fastify();
  const artifactRoot = await createTempDir();

  const userRecord = {
    id: "user_1",
    email: "person@example.com",
    password: "secret",
    createdAt: new Date(),
    orgId: "org_123",
  } as const;

  const bankLineRecord = {
    id: "line_1",
    orgId: "org_123",
    date: new Date(),
    amount: 10,
    payee: "Example Payee",
    desc: "Invoice #1",
    createdAt: new Date(),
  } as const;

  const prismaStub: PrivacyRouteDeps["prisma"] = {
    user: {
      findFirst: async (args) => {
        if (args?.where?.email === userRecord.email && args?.where?.orgId === userRecord.orgId) {
          return { ...userRecord } as any;
        }
        return null;
      },
      update: async () => ({ ...userRecord, email: "updated" } as any),
    },
    bankLine: {
      findMany: async () => [{ ...bankLineRecord } as any],
      updateMany: async () => ({ count: 0 }),
    },
  };

  await registerPrivacyRoutes(app, {
    prisma: prismaStub,
    artifactRoot,
    adminToken: "admin-secret",
  });

  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/admin/privacy/export",
    headers: { "x-admin-token": "admin-secret" },
    payload: { orgId: "org_123", subjectEmail: "person@example.com" },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as any;
  assert.ok(body.artifactId);
  assert.equal(body.bankLineCount, 1);
  assert.equal(body.hasUser, true);

  const artifactPath = path.join(artifactRoot, `${body.artifactId}.json`);
  const rawArtifact = await readFile(artifactPath, "utf8");
  const artifact = JSON.parse(rawArtifact);
  assert.equal(artifact.subjectEmail, "person@example.com");
  assert.equal(Array.isArray(artifact.bankLines), true);
  assert.equal(artifact.bankLines.length, 1);
});

test("POST /admin/privacy/delete anonymizes and audits", async (t) => {
  const app = Fastify();
  const artifactRoot = await createTempDir();

  let updatedUserData: any = null;

  const prismaStub: PrivacyRouteDeps["prisma"] = {
    user: {
      findFirst: async (args) => {
        if (args?.where?.email === "person@example.com" && args?.where?.orgId === "org_123") {
          return {
            id: "user_1",
            email: "person@example.com",
            password: "secret",
            createdAt: new Date(),
            orgId: "org_123",
          } as any;
        }
        return null;
      },
      update: async (args) => {
        updatedUserData = args;
        return {
          id: "user_1",
          email: args.data.email,
          password: args.data.password,
          orgId: "org_123",
          createdAt: new Date(),
        } as any;
      },
    },
    bankLine: {
      findMany: async () => [],
      updateMany: async () => ({ count: 2 }),
    },
  };

  await registerPrivacyRoutes(app, {
    prisma: prismaStub,
    artifactRoot,
    adminToken: "admin-secret",
  });

  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/admin/privacy/delete",
    headers: { "x-admin-token": "admin-secret" },
    payload: { orgId: "org_123", subjectEmail: "person@example.com" },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as any;
  assert.ok(body.auditId);
  assert.equal(body.anonymized, true);
  assert.equal(body.bankLinesUpdated, 2);
  assert.ok(updatedUserData);
  assert.match(updatedUserData.data.email, /^deleted\+/);
  assert.equal(updatedUserData.where.id, "user_1");

  const auditPath = path.join(artifactRoot, `${body.auditId}-delete.json`);
  const rawAudit = await readFile(auditPath, "utf8");
  const audit = JSON.parse(rawAudit);
  assert.equal(audit.action, "privacy_delete");
  assert.equal(audit.bankLinesUpdated, 2);
  assert.equal(audit.anonymizedEmail, updatedUserData.data.email);
});
