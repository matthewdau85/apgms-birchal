import assert from "node:assert/strict";
import { createPublicKey, verify as verifyRaw } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";

let tempDir: string;

async function withFreshArtifactsDir() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kms-artifacts-"));
  process.env.KMS_ARTIFACTS_DIR = tempDir;
}

describe("kms service", () => {
  beforeEach(async () => {
    await withFreshArtifactsDir();
    await import("../src/kms");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.KMS_ARTIFACTS_DIR;
  });

  test("signs, verifies, and supports key rotation", async () => {
    const kms = await import("../src/kms");
    const payload = Buffer.from(`{"ts":${Date.now()}}`);
    const signer = await kms.getSigner("rpt");
    const first = await signer.sign(payload);

    assert.ok(first.version >= 1);
    assert.equal(await signer.verify(payload, first.signature, first.version), true);

    const preRotationMaterial = await kms.loadKeyMaterial("rpt", first.version);
    assert.ok(preRotationMaterial);

    const rotated = await kms.rotateKey("rpt");
    assert.equal(rotated.version, first.version + 1);

    const second = await signer.sign(payload);
    assert.equal(second.version, rotated.version);
    assert.equal(await signer.verify(payload, second.signature, second.version), true);

    const publicKey = createPublicKey(preRotationMaterial!.publicKey);
    const valid = verifyRaw(null, payload, publicKey, Buffer.from(first.signature, "base64"));
    assert.equal(valid, true);
  });

  test("admin key routes enforce RBAC", async () => {
    const { buildApp } = await import("../src/index");
    const prismaStub = {
      user: { findMany: async () => [] },
      bankLine: {
        findMany: async () => [],
        create: async ({ data }: { data: any }) => ({ id: "line", ...data }),
      },
    } satisfies import("../src/index").PrismaLike;

    const app = await buildApp({ logger: false, prisma: prismaStub });

    const rotateDenied = await app.inject({
      method: "POST",
      url: "/admin/keys/rotate",
      payload: { alias: "rpt" },
    });
    assert.equal(rotateDenied.statusCode, 403);

    const rotateAllowed = await app.inject({
      method: "POST",
      url: "/admin/keys/rotate",
      payload: { alias: "rpt" },
      headers: { "x-actor-roles": "admin" },
    });
    assert.equal(rotateAllowed.statusCode, 200);
    const rotationBody = rotateAllowed.json();
    assert.equal(rotationBody.alias, "rpt");
    assert.equal(typeof rotationBody.version, "number");
    assert.equal(typeof rotationBody.publicKey, "string");

    const pubDenied = await app.inject({
      method: "GET",
      url: "/admin/keys/rpt/pub",
    });
    assert.equal(pubDenied.statusCode, 403);

    const pubAllowed = await app.inject({
      method: "GET",
      url: "/admin/keys/rpt/pub",
      headers: { "x-actor-roles": "admin" },
    });
    assert.equal(pubAllowed.statusCode, 200);
    const pubBody = pubAllowed.json();
    assert.deepEqual(pubBody, {
      alias: "rpt",
      version: rotationBody.version,
      publicKey: rotationBody.publicKey,
    });

    await app.close();
  });
});
