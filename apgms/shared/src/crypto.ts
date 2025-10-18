import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from "node:crypto";

export type Sha256Input = Buffer | string;

export function sha256(input: Sha256Input): string {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return createHash("sha256").update(buffer).digest("hex");
}

export interface DevEd25519KeyPair {
  publicKey: string;
  privateKey: string;
}

function normalizeSeed(seed?: string | Buffer): Buffer {
  if (seed instanceof Buffer) {
    if (seed.length >= 32) {
      return seed.subarray(0, 32);
    }
    const buf = Buffer.alloc(32);
    seed.copy(buf);
    return buf;
  }

  const source = typeof seed === "string" ? seed : "apgms-dev-seed";
  const digest = createHash("sha256").update(source).digest();
  return digest.subarray(0, 32);
}

export function generateDevEd25519KeyPair(seed?: string | Buffer): DevEd25519KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    seed: normalizeSeed(seed),
  });

  return {
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
}

export type SignInput = Buffer | string;

export function sign(message: SignInput, privateKeyBase64: string): string {
  const payload = typeof message === "string" ? Buffer.from(message) : message;
  const key = createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const signature = nodeSign(null, payload, key);
  return signature.toString("base64");
}

export function verify(message: SignInput, signatureBase64: string, publicKeyBase64: string): boolean {
  const payload = typeof message === "string" ? Buffer.from(message) : message;
  const key = createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki",
  });
  const signature = Buffer.from(signatureBase64, "base64");
  return nodeVerify(null, payload, key, signature);
}
