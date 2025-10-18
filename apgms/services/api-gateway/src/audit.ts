import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { config } from "./config.js";

export interface AuditEntry {
  id: string;
  prevHash: string;
  hash: string;
  timestamp: string;
  payload: Record<string, unknown>;
  signature: string;
}

const auditTrail: AuditEntry[] = [];

function ensureKeyPair() {
  if (config.auditPrivateKey && config.auditPublicKey) {
    return {
      privateKey: createPrivateKey({
        key: Buffer.from(config.auditPrivateKey, "base64"),
        format: "der",
        type: "pkcs8",
      }),
      publicKey: createPublicKey({
        key: Buffer.from(config.auditPublicKey, "base64"),
        format: "der",
        type: "spki",
      }),
    } as const;
  }

  const seed = config.auditSeed.subarray(0, 32);
  const pkcs8Header = Buffer.from("302e020100300506032b657004220420", "hex");
  const privateKeyDer = Buffer.concat([pkcs8Header, seed]);
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);

  return { privateKey, publicKey } as const;
}

const keys = ensureKeyPair();

function exportSignature(signature: Buffer) {
  return signature.toString("base64");
}

function computeHash(payload: Record<string, unknown>, prevHash: string) {
  return createHash("sha256")
    .update(prevHash)
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function appendAuditEntry(
  id: string,
  payload: Record<string, unknown>
) {
  const prevHash = auditTrail.length
    ? auditTrail[auditTrail.length - 1].hash
    : "GENESIS";
  const hash = computeHash(payload, prevHash);
  const timestamp = new Date().toISOString();
  const message = Buffer.from(`${id}:${timestamp}:${hash}`);
  const signature = sign(null, message, keys.privateKey);

  const entry: AuditEntry = {
    id,
    prevHash,
    hash,
    timestamp,
    payload,
    signature: exportSignature(signature),
  };

  auditTrail.push(entry);

  return entry;
}

export function getAuditEntry(id: string) {
  return auditTrail.find((entry) => entry.id === id) ?? null;
}

export function verifyAuditTrail(uptoId?: string) {
  let prevHash = "GENESIS";
  const uptoIndex = uptoId
    ? auditTrail.findIndex((entry) => entry.id === uptoId)
    : auditTrail.length - 1;

  if (uptoIndex === -1) {
    return { valid: false, entry: null } as const;
  }

  for (let index = 0; index <= uptoIndex; index += 1) {
    const entry = auditTrail[index];
    const recomputedHash = computeHash(entry.payload, prevHash);
    if (recomputedHash !== entry.hash || entry.prevHash !== prevHash) {
      return { valid: false, entry } as const;
    }

    const message = Buffer.from(
      `${entry.id}:${entry.timestamp}:${entry.hash}`
    );
    const signature = Buffer.from(entry.signature, "base64");
    const verified = verify(null, message, keys.publicKey, signature);

    if (!verified) {
      return { valid: false, entry } as const;
    }

    prevHash = entry.hash;
  }

  const entry = uptoIndex >= 0 ? auditTrail[uptoIndex] : null;
  return { valid: true, entry } as const;
}

export function resetAuditTrail() {
  auditTrail.splice(0, auditTrail.length);
}

export function exportAuditTrail() {
  return auditTrail.map((entry) => ({ ...entry }));
}
