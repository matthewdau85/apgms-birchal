import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signRaw,
  verify as verifyRaw,
} from "node:crypto";

export interface KeyMaterial {
  alias: string;
  version: number;
  createdAt: string;
  publicKey: string;
  privateKey: string;
}

export interface SignResult {
  signature: string;
  version: number;
}

export interface Signer {
  sign(payload: Buffer | string): Promise<SignResult>;
  verify(payload: Buffer | string, signature: string, version?: number): Promise<boolean>;
  getPublicKey(version?: number): Promise<{ version: number; publicKey: string }>;
}

const VERSION_FILE_PREFIX = "v";
const VERSION_PAD = 6;

function normalizeAlias(alias: string): string {
  const trimmed = alias.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error(`Invalid key alias: ${alias}`);
  }
  return trimmed;
}

function resolveArtifactsBase(): string {
  const configured = process.env.KMS_ARTIFACTS_DIR;
  if (configured && configured.length > 0) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), "artifacts", "kms");
}

function aliasDir(alias: string): string {
  return path.join(resolveArtifactsBase(), normalizeAlias(alias));
}

async function ensureAliasDir(alias: string): Promise<string> {
  const dir = aliasDir(alias);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function formatVersion(version: number): string {
  return `${VERSION_FILE_PREFIX}${String(version).padStart(VERSION_PAD, "0")}`;
}

function parseVersion(filename: string): number | null {
  const match = filename.match(/^v(\d+)\.json$/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1]!, 10);
}

async function readMaterialFile(filepath: string): Promise<KeyMaterial | null> {
  try {
    const raw = await fs.readFile(filepath, "utf8");
    const parsed = JSON.parse(raw) as KeyMaterial;
    return parsed;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function listKeyVersions(alias: string): Promise<number[]> {
  const dir = aliasDir(alias);
  try {
    const files = await fs.readdir(dir);
    return files
      .map((file) => parseVersion(file))
      .filter((version): version is number => typeof version === "number" && !Number.isNaN(version))
      .sort((a, b) => a - b);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

export async function loadKeyMaterial(alias: string, version?: number): Promise<KeyMaterial | null> {
  const normalized = normalizeAlias(alias);
  const dir = aliasDir(normalized);
  if (version !== undefined) {
    const filepath = path.join(dir, `${formatVersion(version)}.json`);
    return readMaterialFile(filepath);
  }
  const versions = await listKeyVersions(normalized);
  if (versions.length === 0) {
    return null;
  }
  const latestVersion = versions[versions.length - 1]!;
  const filepath = path.join(dir, `${formatVersion(latestVersion)}.json`);
  return readMaterialFile(filepath);
}

function bufferize(payload: Buffer | string): Buffer {
  return typeof payload === "string" ? Buffer.from(payload) : payload;
}

function signWithKey(payload: Buffer, keyPem: string): Buffer {
  const privateKey = createPrivateKey(keyPem);
  return signRaw(null, payload, privateKey);
}

function verifyWithKey(payload: Buffer, signature: Buffer, keyPem: string): boolean {
  const publicKey = createPublicKey(keyPem);
  return verifyRaw(null, payload, publicKey, signature);
}

export async function rotateKey(alias: string): Promise<KeyMaterial> {
  const normalized = normalizeAlias(alias);
  const dir = await ensureAliasDir(normalized);
  const existing = await loadKeyMaterial(normalized);
  const nextVersion = (existing?.version ?? 0) + 1;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const material: KeyMaterial = {
    alias: normalized,
    version: nextVersion,
    createdAt: new Date().toISOString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
  const filepath = path.join(dir, `${formatVersion(material.version)}.json`);
  await fs.writeFile(filepath, JSON.stringify(material, null, 2), "utf8");
  return material;
}

async function ensureKeyMaterial(alias: string): Promise<KeyMaterial> {
  const current = await loadKeyMaterial(alias);
  if (current) {
    return current;
  }
  return rotateKey(alias);
}

export async function getSigner(alias: string): Promise<Signer> {
  const normalized = normalizeAlias(alias);
  await ensureAliasDir(normalized);
  await ensureKeyMaterial(normalized);

  return {
    async sign(payload: Buffer | string) {
      const latest = await ensureKeyMaterial(normalized);
      const signature = signWithKey(bufferize(payload), latest.privateKey).toString("base64");
      return { signature, version: latest.version };
    },
    async verify(payload: Buffer | string, signature: string, version?: number) {
      const material = version !== undefined ? await loadKeyMaterial(normalized, version) : await ensureKeyMaterial(normalized);
      if (!material) {
        return false;
      }
      const isValid = verifyWithKey(bufferize(payload), Buffer.from(signature, "base64"), material.publicKey);
      return isValid;
    },
    async getPublicKey(version?: number) {
      const material = version !== undefined ? await loadKeyMaterial(normalized, version) : await ensureKeyMaterial(normalized);
      if (!material) {
        throw new Error(`No key material for alias ${normalized}`);
      }
      return { version: material.version, publicKey: material.publicKey };
    },
  };
}

export function verifySignatureWithMaterial(
  material: KeyMaterial,
  payload: Buffer | string,
  signature: string,
): boolean {
  return verifyWithKey(bufferize(payload), Buffer.from(signature, "base64"), material.publicKey);
}

export function getArtifactsDirectory(): string {
  return resolveArtifactsBase();
}
