import { promises as fs } from "node:fs";
import path from "node:path";
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, KeyObject } from "node:crypto";

export interface Signer {
  alias: string;
  keyId: string;
  publicKey: string;
  sign(data: Buffer): Buffer;
  verify(data: Buffer, signature: Buffer): boolean;
}

interface StoredKey {
  alias: string;
  keyId: string;
  createdAt: string;
  publicKey: string;
  privateKey: string;
}

const ARTIFACTS_ROOT = path.resolve(process.cwd(), "apgms/artifacts/kms");

async function ensureDir() {
  await fs.mkdir(ARTIFACTS_ROOT, { recursive: true });
}

function buildKeyId(): string {
  return new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
}

function keyFileName(alias: string, keyId: string): string {
  return `${alias}-${keyId}.json`;
}

async function readKeyFile(filePath: string): Promise<StoredKey> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as StoredKey;
}

function hydrateSigner(record: StoredKey): Signer {
  const privateKey: KeyObject = createPrivateKey(record.privateKey);
  const publicKey: KeyObject = createPublicKey(record.publicKey);
  return {
    alias: record.alias,
    keyId: record.keyId,
    publicKey: record.publicKey,
    sign(data: Buffer): Buffer {
      return sign(null, data, privateKey);
    },
    verify(data: Buffer, signature: Buffer): boolean {
      return verify(null, data, publicKey, signature);
    },
  };
}

async function latestKeyPath(alias: string): Promise<string | null> {
  await ensureDir();
  const files = await fs.readdir(ARTIFACTS_ROOT);
  const matches = files
    .filter((file) => file.startsWith(`${alias}-`) && file.endsWith(".json"))
    .sort()
    .reverse();
  if (matches.length === 0) {
    return null;
  }
  return path.join(ARTIFACTS_ROOT, matches[0]);
}

export async function rotateKey(alias: string): Promise<Signer> {
  await ensureDir();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const keyId = buildKeyId();
  const stored: StoredKey = {
    alias,
    keyId,
    createdAt: new Date().toISOString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
  const filePath = path.join(ARTIFACTS_ROOT, keyFileName(alias, keyId));
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2), "utf8");
  return hydrateSigner(stored);
}

export async function getSigner(alias: string, options: { createIfMissing?: boolean } = {}): Promise<Signer | null> {
  const createIfMissing = options.createIfMissing ?? true;
  const latest = await latestKeyPath(alias);
  if (!latest) {
    if (!createIfMissing) {
      return null;
    }
    return rotateKey(alias);
  }
  const record = await readKeyFile(latest);
  return hydrateSigner(record);
}
