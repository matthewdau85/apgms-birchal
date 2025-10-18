import { generateKeyPairSync, sign as signRaw, verify as verifyRaw } from "node:crypto";

const keyPair = generateKeyPairSync("ed25519");
const publicKeyDer = keyPair.publicKey.export({ format: "der", type: "spki" }) as Buffer;

function toBuffer(bytes: Uint8Array | string): Buffer {
  if (typeof bytes === "string") {
    return Buffer.from(bytes);
  }
  return Buffer.from(bytes);
}

export function sign(bytes: Uint8Array | string): string {
  const buffer = toBuffer(bytes);
  const signature = signRaw(null, buffer, keyPair.privateKey);
  return Buffer.from(signature).toString("base64");
}

export function verify(bytes: Uint8Array | string, signature: string): boolean {
  const buffer = toBuffer(bytes);
  const sigBuffer = Buffer.from(signature, "base64");
  return verifyRaw(null, buffer, keyPair.publicKey, sigBuffer);
}

export function pubkey(): string {
  return Buffer.from(publicKeyDer).toString("base64");
}
