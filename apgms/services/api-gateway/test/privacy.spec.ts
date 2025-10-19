import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";

import { registerAdminPrivacyRoutes } from "../src/routes/admin-privacy";

const ADMIN_TOKEN = "secret";

const createDecimal = (value: string) => ({
  toString: () => value,
});

type PrismaOrgStub = {
  org: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: { where: { id: string }; data: { deletedAt: Date; piiRedactedAt: Date } }) => Promise<any>;
  };
};

const buildApp = async (prisma: PrismaOrgStub, exportDir?: string) => {
  const targetDir = exportDir ?? (await mkdtemp(path.join(os.tmpdir(), "privacy-export-")));
  const app = Fastify();
  registerAdminPrivacyRoutes(app, {
    prisma,
    adminToken: ADMIN_TOKEN,
    exportDir: targetDir,
  });
  await app.ready();
  return { app, exportDir: targetDir };
};

test("admin routes reject missing token", async (t) => {
  const prisma: PrismaOrgStub = {
    org: {
      findUnique: async () => null,
      update: async () => {
        throw new Error("should not update");
      },
    },
  };
  const { app } = await buildApp(prisma);
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/export/org-1",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("export bundles org, users, and bank lines", async (t) => {
  const exportDir = await mkdtemp(path.join(os.tmpdir(), "privacy-bundle-"));
  const now = new Date("2024-06-01T00:00:00.000Z");
  const prisma: PrismaOrgStub = {
    org: {
      findUnique: async () => ({
        id: "org-export",
        name: "Acme Corp",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        deletedAt: null,
        piiRedactedAt: null,
        users: [
          {
            id: "user-1",
            email: "alice@example.com",
            createdAt: new Date("2023-01-02T00:00:00.000Z"),
          },
        ],
        lines: [
          {
            id: "line-1",
            date: new Date("2023-02-01T00:00:00.000Z"),
            amount: createDecimal("123.45"),
            payee: "Supplier",
            desc: "Invoice",
            createdAt: new Date("2023-02-01T12:00:00.000Z"),
          },
        ],
      }),
      update: async () => ({
        id: "org-export",
        deletedAt: now,
        piiRedactedAt: now,
      }),
    },
  };
  const { app } = await buildApp(prisma, exportDir);
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/export/org-export",
    headers: { ["x-admin-token"]: ADMIN_TOKEN },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as any;
  assert.equal(payload.org.id, "org-export");
  assert.equal(payload.org.name, "Acme Corp");
  assert.equal(payload.users.length, 1);
  assert.equal(payload.bankLines.length, 1);
  assert.equal(payload.bankLines[0].amount, "123.45");

  const files = await readdir(exportDir);
  assert.equal(files.length, 1);
  const exportPath = path.join(exportDir, files[0]);
  const fileContent = JSON.parse(await readFile(exportPath, "utf8"));
  assert.equal(fileContent.org.id, "org-export");
  assert.equal(fileContent.users[0].email, "alice@example.com");
});

test("delete route marks timestamps", async (t) => {
  let capturedDeletedAt: Date | null = null;
  let capturedRedactedAt: Date | null = null;
  const prisma: PrismaOrgStub = {
    org: {
      findUnique: async () => null,
      update: async ({ data, where }) => {
        assert.equal(where.id, "org-del");
        capturedDeletedAt = data.deletedAt;
        capturedRedactedAt = data.piiRedactedAt;
        return {
          id: where.id,
          deletedAt: data.deletedAt,
          piiRedactedAt: data.piiRedactedAt,
        };
      },
    },
  };
  const { app } = await buildApp(prisma);
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/delete/org-del",
    headers: { ["x-admin-token"]: ADMIN_TOKEN },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as any;
  assert.equal(body.org.id, "org-del");
  assert.ok(body.org.deletedAt);
  assert.ok(body.org.piiRedactedAt);
  assert.ok(capturedDeletedAt instanceof Date);
  assert.ok(capturedRedactedAt instanceof Date);
});
