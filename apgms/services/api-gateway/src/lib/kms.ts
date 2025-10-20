import * as fs from "node:fs/promises";
import path from "node:path";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import nacl from "tweetnacl";

export interface KeyRecord {
  alias: string;
  version: number;
  createdAt: string;
  publicKey: string;
  secretKey: string;
}

export interface Signer {
  version: number;
  publicKey: string;
  sign(input: Uint8Array | string): Promise<string>;
  verify(input: Uint8Array | string, signature: string): Promise<boolean>;
}

const ARTIFACT_ROOT = path.resolve(process.cwd(), "artifacts", "kms");
const VERSION_PAD_LENGTH = 6;
const subtle = webcrypto?.subtle;

const encoder = new TextEncoder();

function encodeAlias(alias: string): string {
  return alias.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function artifactFilename(alias: string, version: number): string {
  return `${encodeAlias(alias)}.v${version
    .toString()
    .padStart(VERSION_PAD_LENGTH, "0")}.json`;
}

function artifactPath(alias: string, version: number): string {
  return path.join(ARTIFACT_ROOT, artifactFilename(alias, version));
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMaybeKeyRecord(json: string): KeyRecord {
  const record = JSON.parse(json);
  if (
    typeof record !== "object" ||
    record === null ||
    typeof record.alias !== "string" ||
    typeof record.version !== "number" ||
    typeof record.createdAt !== "string" ||
    typeof record.publicKey !== "string" ||
    typeof record.secretKey !== "string"
  ) {
    throw new Error("Invalid key record");
  }
  return record as KeyRecord;
}

async function ensureArtifactDir(): Promise<void> {
  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
}

function toBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64");
}

function toBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64url");
}

function fromBase64(value: string): Uint8Array {
  return Buffer.from(value, "base64");
}

function toUint8Array(input: Uint8Array | string): Uint8Array {
  return typeof input === "string" ? encoder.encode(input) : input;
}

function deriveKeyPairFromSeed(seed: Uint8Array): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  if (seed.length !== nacl.sign.seedLength) {
    throw new Error("Invalid Ed25519 seed length");
  }
  const pair = nacl.sign.keyPair.fromSeed(seed);
  return { publicKey: pair.publicKey, secretKey: pair.secretKey };
}

async function generateKeyMaterial(): Promise<{
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}> {
  if (subtle) {
    try {
      const keyPair = await subtle.generateKey(
        { name: "Ed25519" },
        true,
        ["sign", "verify"]
      );

      const privateJwk = await subtle.exportKey("jwk", keyPair.privateKey);
      if (!("d" in privateJwk) || typeof privateJwk.d !== "string") {
        throw new Error("Unable to export private key material");
      }
      const seed = Buffer.from(privateJwk.d, "base64url");
      return deriveKeyPairFromSeed(seed);
    } catch (error) {
      // Fall back to Node's synchronous generator if subtle fails.
      if (error instanceof Error) {
        // no-op, will fall through to generateKeyPairSync
      }
    }
  }

  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as { d: string };

  if (!jwk.d) {
    throw new Error("Unable to export private key JWK");
  }

  const seed = Buffer.from(jwk.d, "base64url");
  return deriveKeyPairFromSeed(seed);
}

export async function loadLatestKey(alias: string): Promise<KeyRecord | undefined> {
  const encodedAlias = encodeAlias(alias);
  let entries: string[];
  try {
    entries = await fs.readdir(ARTIFACT_ROOT);
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  const pattern = new RegExp(
    `^${escapeForRegex(encodedAlias)}\\.v(\\d{${VERSION_PAD_LENGTH}})\\.json$`
  );

  const versions = entries
    .map((entry) => {
      const match = entry.match(pattern);
      if (!match) return undefined;
      return { version: Number.parseInt(match[1], 10), file: entry };
    })
    .filter((value): value is { version: number; file: string } =>
      Boolean(value)
    )
    .sort((a, b) => b.version - a.version);

  if (versions.length === 0) {
    return undefined;
  }

  const latest = versions[0];
  const filePath = path.join(ARTIFACT_ROOT, latest.file);
  const content = await fs.readFile(filePath, "utf8");
  const record = parseMaybeKeyRecord(content);
  return record;
}

export async function rotateKey(alias: string): Promise<KeyRecord> {
  await ensureArtifactDir();
  const previous = await loadLatestKey(alias);
  const version = previous ? previous.version + 1 : 1;
  const timestamp = new Date().toISOString();
  const keyMaterial = await generateKeyMaterial();

  const record: KeyRecord = {
    alias,
    version,
    createdAt: timestamp,
    publicKey: toBase64(keyMaterial.publicKey),
    secretKey: toBase64(keyMaterial.secretKey),
  };

  const file = artifactPath(alias, version);
  await fs.writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export async function getSigner(alias: string): Promise<Signer> {
  let record = await loadLatestKey(alias);
  if (!record) {
    record = await rotateKey(alias);
  }

  const publicKeyBytes = fromBase64(record.publicKey);
  const secretKeyBytes = fromBase64(record.secretKey);

  if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
    throw new Error("Invalid Ed25519 public key length");
  }

  if (secretKeyBytes.length !== nacl.sign.secretKeyLength) {
    throw new Error("Invalid Ed25519 secret key length");
  }

  if (subtle) {
    const jwk = {
      kty: "OKP" as const,
      crv: "Ed25519" as const,
      x: toBase64Url(publicKeyBytes),
      d: toBase64Url(secretKeyBytes.subarray(0, 32)),
    };

    const publicKey = await subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x },
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const privateKey = await subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["sign"]
    );

    return {
      version: record.version,
      publicKey: record.publicKey,
      async sign(input) {
        const data = toUint8Array(input);
        const signature = await subtle.sign({ name: "Ed25519" }, privateKey, data);
        return toBase64(new Uint8Array(signature));
      },
      async verify(input, signature) {
        const data = toUint8Array(input);
        try {
          return await subtle.verify(
            { name: "Ed25519" },
            publicKey,
            Buffer.from(signature, "base64"),
            data
          );
        } catch {
          return false;
        }
      },
    };
  }

  return {
    version: record.version,
    publicKey: record.publicKey,
    async sign(input) {
      const data = toUint8Array(input);
      const signature = nacl.sign.detached(data, secretKeyBytes);
      return toBase64(signature);
    },
    async verify(input, signature) {
      const data = toUint8Array(input);
      const signatureBytes = Buffer.from(signature, "base64");
      return nacl.sign.detached.verify(data, signatureBytes, publicKeyBytes);
    },
  };
}

export const kmsArtifactsPath = ARTIFACT_ROOT;
