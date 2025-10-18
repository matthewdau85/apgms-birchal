import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { promises as fs, mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  AwsKmsSigner,
  DevMemorySigner,
  getSignerProviderFromEnv,
} from "../src/lib/kms";
import { signRpt, verifyRpt } from "../src/lib/rpt";

class FakeSignCommand {
  readonly input;

  constructor(input: any) {
    this.input = input;
  }
}

class FakeVerifyCommand {
  readonly input;

  constructor(input: any) {
    this.input = input;
  }
}

describe("Signer providers", () => {
  afterEach(() => {
    delete process.env.SIGNER_PROVIDER;
    delete process.env.KMS_KEY_ID;
    delete process.env.AWS_REGION;
  });

  it("signs and verifies RPTs using the dev memory signer", async () => {
    const payload = { sub: "user-123", scope: ["read"] };
    const signer = new DevMemorySigner();

    const token = await signRpt(payload, signer);
    const verified = await verifyRpt(token, signer);

    assert.equal(typeof token.signature, "string");
    assert.equal(verified, true);
  });

  it("signs and verifies using AWS KMS", async () => {
    const signature = new Uint8Array(Buffer.from("signed"));
    const send = async (command: any) => {
      if (command instanceof FakeSignCommand) {
        assert.equal(command.input.SigningAlgorithm, "RSASSA_PSS_SHA_256");
        assert.equal(command.input.KeyId, "kms-key-id");
        assert.ok(command.input.Message instanceof Uint8Array);
        return { Signature: signature };
      }

      if (command instanceof FakeVerifyCommand) {
        assert.deepEqual(new Uint8Array(command.input.Signature), signature);
        assert.equal(command.input.KeyId, "kms-key-id");
        return { SignatureValid: true };
      }

      throw new Error("Unexpected command");
    };

    const signer = new AwsKmsSigner({
      keyId: "kms-key-id",
      region: "ap-southeast-2",
      client: { send },
      signCommand: FakeSignCommand,
      verifyCommand: FakeVerifyCommand,
    });

    const payload = { transactionId: "abc", amount: 100 };
    const token = await signRpt(payload, signer);
    assert.equal(token.signature, Buffer.from(signature).toString("base64"));

    const verified = await verifyRpt(token, signer);
    assert.equal(verified, true);
  });

  it("creates evidence when KMS is selected from the environment", async () => {
    const evidenceRoot = mkdtempSync(path.join(tmpdir(), "evidence-"));
    process.env.SIGNER_PROVIDER = "kms";
    process.env.KMS_KEY_ID = "arn:aws:kms:region:acct:key/123";
    process.env.AWS_REGION = "us-east-1";

    const provider = await getSignerProviderFromEnv({
      evidenceRoot,
      kmsClient: { send: async () => ({ Signature: new Uint8Array([1]) }) },
      signCommand: FakeSignCommand,
      verifyCommand: FakeVerifyCommand,
      now: () => new Date("2024-01-02T03:04:05.000Z"),
    });

    assert.ok(provider instanceof AwsKmsSigner);

    const filePath = path.join(evidenceRoot, "keys", "provider.json");
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);

    assert.deepEqual(parsed, {
      provider: "kms",
      keyId: "arn:aws:kms:region:acct:key/123",
      region: "us-east-1",
      ts: "2024-01-02T03:04:05.000Z",
    });
  });
});
