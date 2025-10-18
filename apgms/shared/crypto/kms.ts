import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface KMSKeyMetadata {
  id: string;
  createdAt: string;
}

export interface KMSEnvelope {
  keyId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  aad?: string;
}

interface KMSKeyRecord extends KMSKeyMetadata {
  material: string;
}

interface KMSState {
  activeKeyId: string;
  keys: Record<string, KMSKeyRecord>;
}

export interface KeyManagementService {
  encrypt(plaintext: string | Buffer, aad?: string | Buffer): Promise<KMSEnvelope>;
  decrypt(payload: KMSEnvelope, aad?: string | Buffer): Promise<string>;
  rotate(): Promise<KMSKeyMetadata>;
  getActiveKey(): KMSKeyMetadata;
  listKeys(): KMSKeyMetadata[];
}

function createInitialState(): KMSState {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const material = crypto.randomBytes(32).toString("base64");
  return {
    activeKeyId: id,
    keys: {
      [id]: { id, createdAt, material },
    },
  };
}

function toBuffer(value: string | Buffer | undefined): Buffer | undefined {
  if (!value) return undefined;
  if (Buffer.isBuffer(value)) return value;
  return Buffer.from(value);
}

export function serializeEnvelope(envelope: KMSEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function deserializeEnvelope(serialized: string): KMSEnvelope {
  return JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as KMSEnvelope;
}

export class MockKMS implements KeyManagementService {
  protected state: KMSState;

  constructor(state?: KMSState) {
    this.state = state ?? createInitialState();
  }

  protected getKey(keyId?: string): KMSKeyRecord {
    const id = keyId ?? this.state.activeKeyId;
    const key = this.state.keys[id];
    if (!key) {
      throw new Error(`Unknown key: ${id}`);
    }
    return key;
  }

  async encrypt(plaintext: string | Buffer, aad?: string | Buffer): Promise<KMSEnvelope> {
    const key = this.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key.material, "base64"), iv);
    const aadBuffer = toBuffer(aad);
    if (aadBuffer) {
      cipher.setAAD(aadBuffer);
    }
    const ciphertext = Buffer.concat([cipher.update(toBuffer(plaintext) ?? Buffer.alloc(0)), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      keyId: key.id,
      iv: iv.toString("base64url"),
      authTag: authTag.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      aad: aadBuffer ? aadBuffer.toString("base64url") : undefined,
    };
  }

  async decrypt(payload: KMSEnvelope, aad?: string | Buffer): Promise<string> {
    const key = this.getKey(payload.keyId);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key.material, "base64"),
      Buffer.from(payload.iv, "base64url"),
    );
    const aadBuffer = toBuffer(aad) ?? (payload.aad ? Buffer.from(payload.aad, "base64url") : undefined);
    if (aadBuffer) {
      decipher.setAAD(aadBuffer);
    }
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  async rotate(): Promise<KMSKeyMetadata> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const material = crypto.randomBytes(32).toString("base64");
    this.state.keys[id] = { id, createdAt, material };
    this.state.activeKeyId = id;
    return { id, createdAt };
  }

  getActiveKey(): KMSKeyMetadata {
    const key = this.getKey();
    return { id: key.id, createdAt: key.createdAt };
  }

  listKeys(): KMSKeyMetadata[] {
    return Object.values(this.state.keys)
      .map(({ id, createdAt }) => ({ id, createdAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  exportState(): KMSState {
    return JSON.parse(JSON.stringify(this.state)) as KMSState;
  }
}

async function loadState(filePath: string): Promise<KMSState> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw) as KMSState;
    if (!data.activeKeyId || !data.keys || !data.keys[data.activeKeyId]) {
      throw new Error("Invalid KMS state");
    }
    return data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return createInitialState();
    }
    throw err;
  }
}

export class FileKMS extends MockKMS {
  #filePath: string;

  private constructor(filePath: string, state: KMSState) {
    super(state);
    this.#filePath = filePath;
  }

  static async create(filePath: string): Promise<FileKMS> {
    const resolved = path.resolve(filePath);
    const state = await loadState(resolved);
    const kms = new FileKMS(resolved, state);
    await kms.persist();
    return kms;
  }

  private async persist(): Promise<void> {
    const state = this.exportState();
    await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
    await fs.writeFile(this.#filePath, JSON.stringify(state, null, 2), "utf8");
  }

  override async rotate(): Promise<KMSKeyMetadata> {
    const metadata = await super.rotate();
    await this.persist();
    return metadata;
  }
}

export async function createFileKMS(filePath?: string): Promise<FileKMS> {
  const resolved = filePath ?? path.resolve(process.cwd(), "kms-state.json");
  return FileKMS.create(resolved);
}
