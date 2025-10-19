import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SignedEnvelopeHeader {
  /** Unique identifier for this AS4 message */
  messageId: string;
  /** Conversation identifier used by SBR */
  conversationId: string;
  /** ISO timestamp when the envelope was created */
  createdAt: string;
  /** Organisation identifier submitting the payload */
  sender: string;
  /** Receiver value for downstream systems */
  receiver: string;
  /** Document/document type code */
  documentType: string;
}

export interface SignedEnvelopeSignature {
  /** Hashing algorithm applied to the canonical payload */
  algorithm: "sha256";
  /** Canonicalisation approach used when signing */
  canonicalization: "json";
  /** Hex digest of the canonical payload */
  digest: string;
}

export interface SignedEnvelope {
  header: SignedEnvelopeHeader;
  payload: unknown;
  signature: SignedEnvelopeSignature;
}

export interface EnvelopeMetadata {
  messageId: string;
  conversationId: string;
  documentType: string;
  sender: string;
  receiver: string;
  createdAt: string;
  payloadDigest: string;
  envelopeFile: string;
}

export interface CreateEnvelopeInput {
  orgId: string;
  documentType: string;
  payload: unknown;
  receiver?: string;
  messageId?: string;
  conversationId?: string;
}

export interface SendSbrInput extends CreateEnvelopeInput {
  artifactDir?: string;
}

export interface SendSbrResult {
  envelope: SignedEnvelope;
  metadata: EnvelopeMetadata;
  envelopePath: string;
  metadataPath: string;
}

const DEFAULT_RECEIVER = "ATO-SBR";
const DEFAULT_ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "sbr");

const safeSegment = (value: string): string =>
  value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

const timestampForFile = (iso: string): string => iso.replace(/[:.]/g, "-");

const normalizeForJson = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value as object)) {
    throw new TypeError("Cannot stringify circular structure in payload");
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForJson(entry, seen));
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== "function")
    .sort(([a], [b]) => a.localeCompare(b));

  const normalized: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    normalized[key] = normalizeForJson(val, seen);
  }

  return normalized;
};

export const canonicalJsonStringify = (value: unknown): string =>
  JSON.stringify(normalizeForJson(value));

export const createSignedEnvelope = (input: CreateEnvelopeInput): SignedEnvelope => {
  const createdAt = new Date().toISOString();
  const messageId = input.messageId ?? randomUUID();
  const conversationId = input.conversationId ?? randomUUID();
  const receiver = input.receiver ?? DEFAULT_RECEIVER;

  const canonicalPayload = canonicalJsonStringify(input.payload);
  const digest = createHash("sha256").update(canonicalPayload).digest("hex");

  return {
    header: {
      messageId,
      conversationId,
      createdAt,
      sender: input.orgId,
      receiver,
      documentType: input.documentType,
    },
    payload: input.payload,
    signature: {
      algorithm: "sha256",
      canonicalization: "json",
      digest,
    },
  };
};

const ensureArtifactDir = async (artifactDir: string): Promise<void> => {
  await mkdir(artifactDir, { recursive: true });
};

const persistEnvelopeArtifacts = async (
  envelope: SignedEnvelope,
  artifactDir: string,
): Promise<Pick<SendSbrResult, "envelopePath" | "metadataPath" | "metadata">> => {
  await ensureArtifactDir(artifactDir);

  const baseName = `${timestampForFile(envelope.header.createdAt)}_${safeSegment(
    envelope.header.messageId,
  )}`;
  const envelopePath = path.join(artifactDir, `${baseName}.envelope.json`);
  const metadataPath = path.join(artifactDir, `${baseName}.metadata.json`);

  const metadata: EnvelopeMetadata = {
    messageId: envelope.header.messageId,
    conversationId: envelope.header.conversationId,
    documentType: envelope.header.documentType,
    sender: envelope.header.sender,
    receiver: envelope.header.receiver,
    createdAt: envelope.header.createdAt,
    payloadDigest: envelope.signature.digest,
    envelopeFile: path.basename(envelopePath),
  };

  await writeFile(envelopePath, JSON.stringify(envelope, null, 2));
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  return { envelopePath, metadataPath, metadata };
};

export const sendSbrDocument = async (input: SendSbrInput): Promise<SendSbrResult> => {
  const envelope = createSignedEnvelope(input);
  const artifactDir = input.artifactDir ?? process.env.SBR_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR;

  const { envelopePath, metadataPath, metadata } = await persistEnvelopeArtifacts(
    envelope,
    artifactDir,
  );

  return {
    envelope,
    metadata,
    envelopePath,
    metadataPath,
  };
};

