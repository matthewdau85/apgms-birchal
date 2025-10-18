import {
  KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";

export type SupportedRptAlgorithm = "ed25519";

export interface RptPayload {
  bankLineId: string;
  policyHash: string;
  allocation: unknown;
  timestamp: string;
}

export interface RptToken {
  payload: RptPayload;
  payloadHash: string;
  hash: string;
  prevHash: string | null;
  signature: string;
  algorithm: SupportedRptAlgorithm;
  publicKey: string;
}

export interface RptSignerConfig {
  privateKey: string;
  publicKey?: string;
  algorithm?: SupportedRptAlgorithm;
}

export interface CreateRptTokenParams {
  bankLineId: string;
  policyHash: string;
  allocation: unknown;
  timestamp?: string | Date;
  prevHash?: string | null;
}

export class RptService {
  private readonly algorithm: SupportedRptAlgorithm;
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly publicKeyPem: string;

  constructor(config: RptSignerConfig) {
    this.algorithm = config.algorithm ?? "ed25519";
    if (this.algorithm !== "ed25519") {
      throw new Error(`Unsupported RPT algorithm: ${this.algorithm}`);
    }

    this.privateKey = createPrivateKey({ key: config.privateKey, format: "pem" });
    this.publicKey = createPublicKey({
      key: config.publicKey ?? config.privateKey,
      format: "pem",
    });
    this.publicKeyPem = this.publicKey.export({ format: "pem", type: "spki" }).toString();
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): RptService {
    let privateKey = env.RPT_PRIVATE_KEY;
    let publicKey = env.RPT_PUBLIC_KEY;

    if (!privateKey || !publicKey) {
      const pair = generateKeyPairSync("ed25519");
      privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
      publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    }

    return new RptService({ privateKey, publicKey, algorithm: "ed25519" });
  }

  createToken(params: CreateRptTokenParams): RptToken {
    const payload: RptPayload = {
      bankLineId: params.bankLineId,
      policyHash: params.policyHash,
      allocation: params.allocation,
      timestamp: normaliseTimestamp(params.timestamp),
    };

    const payloadHash = sha256(canonicalize(payload));
    const prevHash = params.prevHash ?? null;
    const rollingHash = computeRollingHash(prevHash, payloadHash);
    const signature = sign(null, Buffer.from(rollingHash, "hex"), this.privateKey).toString("base64");

    return {
      payload,
      payloadHash,
      hash: rollingHash,
      prevHash,
      signature,
      algorithm: this.algorithm,
      publicKey: this.publicKeyPem,
    };
  }

  verifyToken(token: RptToken): boolean {
    const expectedPayloadHash = sha256(canonicalize(token.payload));
    if (expectedPayloadHash !== token.payloadHash) {
      return false;
    }

    const expectedRollingHash = computeRollingHash(token.prevHash, token.payloadHash);
    if (expectedRollingHash !== token.hash) {
      return false;
    }

    try {
      const key = createPublicKey({ key: token.publicKey, format: "pem" });
      return verify(null, Buffer.from(token.hash, "hex"), key, Buffer.from(token.signature, "base64"));
    } catch (error) {
      return false;
    }
  }
}

export function getDefaultRptService(): RptService {
  if (!defaultRptService) {
    defaultRptService = RptService.fromEnv();
  }
  return defaultRptService;
}

let defaultRptService: RptService | null = null;

function computeRollingHash(prevHash: string | null, payloadHash: string): string {
  const hash = createHash("sha256");
  if (prevHash) {
    hash.update(prevHash);
  }
  hash.update(payloadHash);
  return hash.digest("hex");
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => [key, sortValue(val)]);
    return Object.fromEntries(entries);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  }
  return value;
}

function sha256(value: string): string {
  const hash = createHash("sha256");
  hash.update(value);
  return hash.digest("hex");
}

function normaliseTimestamp(timestamp?: string | Date): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return date.toISOString();
}
