import { createHash, createSign, createVerify, randomUUID } from "node:crypto";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface As4Envelope {
  messageId: string;
  createdAt: string;
  payload: Record<string, JsonValue>;
}

export interface DetachedSignature {
  algorithm: "RSA-SHA256";
  value: string; // base64 encoded signature
}

export interface As4Receipt {
  messageId: string;
  receivedAt: string;
  raw: Record<string, JsonValue>;
}

export interface As4Client {
  send(envelope: As4Envelope, signature: DetachedSignature): Promise<As4Receipt>;
}

export function signEnvelope(
  envelope: As4Envelope,
  privateKeyPem: string
): DetachedSignature {
  const canonical = canonicaliseEnvelope(envelope);
  const signer = createSign("RSA-SHA256");
  signer.update(canonical);
  signer.end();
  const value = signer.sign(privateKeyPem, "base64");
  return {
    algorithm: "RSA-SHA256",
    value,
  };
}

export function verifyEnvelope(
  envelope: As4Envelope,
  signature: DetachedSignature,
  publicKeyPem: string
): boolean {
  const canonical = canonicaliseEnvelope(envelope);
  const verifier = createVerify(signature.algorithm);
  verifier.update(canonical);
  verifier.end();
  return verifier.verify(publicKeyPem, signature.value, "base64");
}

export function canonicaliseEnvelope(envelope: As4Envelope): string {
  const normalised = normalise(envelope);
  return JSON.stringify(normalised);
}

function normalise(value: JsonValue | As4Envelope | Record<string, JsonValue>): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalise(entry as JsonValue));
  }
  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const output: Record<string, JsonValue> = {};
    for (const key of sortedKeys) {
      output[key] = normalise((value as Record<string, JsonValue>)[key]);
    }
    return output;
  }
  return value as JsonValue;
}

export function createBasEnvelope(payload: Record<string, JsonValue>): As4Envelope {
  return {
    messageId: randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };
}

export function buildReceipt(envelope: As4Envelope): As4Receipt {
  return {
    messageId: envelope.messageId,
    receivedAt: new Date().toISOString(),
    raw: {
      status: "ACCEPTED",
      correlationId: envelope.messageId,
      digest: createHash("sha256")
        .update(JSON.stringify(normalise(envelope.payload)))
        .digest("hex"),
    },
  };
}
