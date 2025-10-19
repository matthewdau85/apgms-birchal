import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signEd25519,
  verify as verifyEd25519,
  KeyObject,
} from "node:crypto";

export type KeyRecord = {
  alias: string;
  version: number;
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, "../../../../artifacts/kms");

async function ensureArtifactsDir() {
  await fs.mkdir(artifactsDir, { recursive: true });
}

function keyFilename(alias: string, version: number) {
  return `${alias}-v${version}.json`;
}

async function readKeyRecord(filePath: string): Promise<KeyRecord> {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw) as KeyRecord;
  return data;
}

function escapeAliasForRegex(alias: string): string {
  return alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadKeyRecord(alias: string, version?: number): Promise<KeyRecord | undefined> {
  await ensureArtifactsDir();
  const entries = await fs.readdir(artifactsDir);
  const pattern = new RegExp(`^${escapeAliasForRegex(alias)}-v(\\d+)\\.json$`);
  const matching = entries
    .map((file) => {
      const match = file.match(pattern);
      if (!match) return undefined;
      return { file, version: Number(match[1]) };
    })
    .filter((item): item is { file: string; version: number } => Boolean(item));

  if (matching.length === 0) {
    return undefined;
  }

  let target = matching[0];
  if (typeof version === "number") {
    target = matching.find((m) => m.version === version) ?? target;
  } else {
    for (const entry of matching) {
      if (entry.version > target.version) {
        target = entry;
      }
    }
  }

  if (typeof version === "number" && target.version !== version) {
    return undefined;
  }

  return readKeyRecord(path.join(artifactsDir, target.file));
}

function createKeyObjects(record: KeyRecord): { privateKey: KeyObject; publicKey: KeyObject } {
  const privateKey = createPrivateKey({
    key: Buffer.from(record.privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey({
    key: Buffer.from(record.publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  return { privateKey, publicKey };
}

export async function getSigner(alias: string): Promise<{
  sign(buf: Uint8Array): Promise<string>;
  verify(buf: Uint8Array, sigB64: string): Promise<boolean>;
  publicKey: string;
  version: number;
}> {
  let record = await loadKeyRecord(alias);
  if (!record) {
    record = await rotateKey(alias);
  }

  const { privateKey, publicKey } = createKeyObjects(record);

  return {
    publicKey: record.publicKey,
    version: record.version,
    async sign(buf: Uint8Array): Promise<string> {
      const signature = signEd25519(null, Buffer.from(buf), privateKey);
      return signature.toString("base64");
    },
    async verify(buf: Uint8Array, sigB64: string): Promise<boolean> {
      try {
        return verifyEd25519(null, Buffer.from(buf), publicKey, Buffer.from(sigB64, "base64"));
      } catch {
        return false;
      }
    },
  };
}

export async function rotateKey(alias: string): Promise<KeyRecord> {
  await ensureArtifactsDir();
  const current = await loadKeyRecord(alias);
  const nextVersion = (current?.version ?? 0) + 1;

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

  const record: KeyRecord = {
    alias,
    version: nextVersion,
    publicKey: publicKeyDer,
    privateKey: privateKeyDer,
    createdAt: new Date().toISOString(),
  };

  const filePath = path.join(artifactsDir, keyFilename(alias, record.version));
  await fs.writeFile(filePath, JSON.stringify(record, null, 2));

  return record;
}

export async function getKeyRecord(alias: string, version: number): Promise<KeyRecord | undefined> {
  return loadKeyRecord(alias, version);
}
