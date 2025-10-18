import { randomUUID, sign, verify } from "node:crypto";
import { getDevEd25519Keypair } from "../../../../shared/src/crypto";

type JsonValue = unknown;

export interface RptPayload {
  tokenId: string;
  orgId: string;
  ledgerEntryId: string;
  issuedAt: string;
}

export interface RptToken {
  payload: RptPayload;
  signature: string;
}

function canonicalize(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Non-finite number encountered in RPT payload");
    }
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "undefined") {
    return "null";
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item as JsonValue)).join(",")}]`;
  }
  if (typeof value === "object") {
    if ("toJSON" in value && typeof (value as any).toJSON === "function") {
      return canonicalize((value as any).toJSON() as JsonValue);
    }
    const entries = Object.entries(value as Record<string, JsonValue>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function mintRpt(base: Omit<RptPayload, "tokenId"> & { tokenId?: string }): RptToken {
  const tokenId = base.tokenId ?? randomUUID();
  const payload: RptPayload = {
    tokenId,
    orgId: base.orgId,
    ledgerEntryId: base.ledgerEntryId,
    issuedAt: base.issuedAt,
  };

  const message = canonicalize(payload);
  const { privateKey } = getDevEd25519Keypair();
  const signature = sign(null, Buffer.from(message), privateKey).toString("base64url");

  return { payload, signature };
}

export function verifyRpt(token: RptToken): boolean {
  const message = canonicalize(token.payload);
  const { publicKey } = getDevEd25519Keypair();
  return verify(null, Buffer.from(message), publicKey, Buffer.from(token.signature, "base64url"));
}
