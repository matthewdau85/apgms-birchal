import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { buildApp, type PrismaLike } from "../services/api-gateway/src/app";

type MockedPrisma = PrismaLike;

const records: any[] = [];

function createPrismaStub(): MockedPrisma {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({}),
    },
    sbrMessage: {
      async create({ data }) {
        const record = {
          ...data,
          id: `sbr_${records.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        records.push(record);
        return record;
      },
      async findUnique({ where }: { where: { messageId: string } }) {
        return records.find((record) => record.messageId === where.messageId) ?? null;
      },
    },
  };
}

test.describe("SBR API integration", () => {
  let artifactsDir: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  test.beforeEach(async () => {
    records.length = 0;
    artifactsDir = await mkdtemp(path.join(tmpdir(), "sbr-artifacts-"));
    process.env.SBR_ARTIFACTS_DIR = artifactsDir;
    const prisma = createPrismaStub();
    app = await buildApp({ prisma });
  });

  test.afterEach(async () => {
    await app.close();
    await rm(artifactsDir, { recursive: true, force: true });
    delete process.env.SBR_ARTIFACTS_DIR;
  });

  test("persists artifacts and stores message metadata", async () => {
    const payloadXml = "<Payload><Amount>100</Amount></Payload>";

    const submitResponse = await app.inject({
      method: "POST",
      url: "/sbr/submit",
      payload: {
        orgId: "org_123",
        payloadXml,
        metadata: { correlationId: "corr-1" },
        attachments: [
          {
            name: "invoice-1.txt",
            content: "hello world",
          },
        ],
      },
    });

    assert.equal(submitResponse.statusCode, 201);
    const body = submitResponse.json() as { message: { messageId: string } };
    const messageId = body.message.messageId;
    assert.ok(messageId);

    const manifestPath = path.join(artifactsDir, messageId, "manifest.json");
    const payloadPath = path.join(artifactsDir, messageId, "payload.xml");
    const attachmentPath = path.join(artifactsDir, messageId, "attachments", "invoice-1.txt");

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const storedPayload = await readFile(payloadPath, "utf8");
    const attachmentContent = await readFile(attachmentPath, "utf8");

    assert.equal(storedPayload, payloadXml);
    assert.equal(manifest.orgId, "org_123");
    assert.deepEqual(manifest.metadata, { correlationId: "corr-1" });
    assert.equal(manifest.attachments.length, 1);
    assert.equal(manifest.attachments[0].name, "invoice-1.txt");
    assert.equal(attachmentContent, "hello world");

    const detailsResponse = await app.inject({
      method: "GET",
      url: `/sbr/message/${messageId}`,
    });

    assert.equal(detailsResponse.statusCode, 200);
    const details = detailsResponse.json() as { message: { metadata: Record<string, unknown> | null } };
    assert.deepEqual(details.message.metadata, { correlationId: "corr-1" });
  });
});
