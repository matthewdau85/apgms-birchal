import { createHash, createHmac, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const ARTIFACT_ROOT = path.resolve(process.cwd(), 'tmp/as4-artifacts');
const SIGNING_SECRET = 'apgms-sbr-signing-key';
const SERVICE_NAME = 'APGMS-SBR';

export type ArtifactName = 'envelope' | 'digest' | 'receipt' | 'messageId' | 'signature';

const ARTIFACT_FILENAMES: Record<ArtifactName, string> = {
  envelope: 'envelope.xml',
  digest: 'digest.txt',
  receipt: 'receipt.json',
  messageId: 'message-id.txt',
  signature: 'signature.txt',
};

const ARTIFACT_CONTENT_TYPES: Record<ArtifactName, string> = {
  envelope: 'application/xml',
  digest: 'text/plain',
  receipt: 'application/json',
  messageId: 'text/plain',
  signature: 'text/plain',
};

export interface As4EnvelopeOptions {
  messageId?: string;
  payload: unknown;
  createdAt?: string;
  service?: string;
}

export interface Receipt {
  messageId: string;
  digest: string;
  signature: string;
  createdAt: string;
  service: string;
  status: 'RECEIVED';
}

export interface PersistArtifactsOptions {
  messageId: string;
  envelope: string;
  digest: string;
  receipt: Receipt;
  signature: string;
}

export type ArtifactRecord = Record<ArtifactName, string>;

export const ensureArtifactRoot = async () => {
  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const canonicalizePayload = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return JSON.stringify(String(value));
    }

    return JSON.stringify(value);
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizePayload(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const canonicalEntries = entries.map(
      ([key, val]) => `${JSON.stringify(key)}:${canonicalizePayload(val)}`,
    );
    return `{${canonicalEntries.join(',')}}`;
  }

  return 'null';
};

export const buildAs4Envelope = ({
  messageId = `msg-${randomUUID()}`,
  payload,
  createdAt = new Date().toISOString(),
  service = SERVICE_NAME,
}: As4EnvelopeOptions): { messageId: string; envelope: string; createdAt: string } => {
  const canonicalPayload = canonicalizePayload(payload);
  const encodedPayload = Buffer.from(canonicalPayload).toString('base64');

  const envelope = [
    '<AS4Envelope>',
    '  <Header>',
    `    <MessageId>${escapeXml(messageId)}</MessageId>`,
    `    <Timestamp>${escapeXml(createdAt)}</Timestamp>`,
    `    <Service>${escapeXml(service)}</Service>`,
    '  </Header>',
    `  <Payload>${encodedPayload}</Payload>`,
    '</AS4Envelope>',
  ].join('\n');

  return { messageId, envelope, createdAt };
};

export const computeCanonicalHash = (envelope: string): string =>
  createHash('sha256').update(envelope).digest('hex');

export const signDigest = (digest: string): string =>
  createHmac('sha256', SIGNING_SECRET).update(digest).digest('hex');

export const createReceipt = ({
  messageId,
  digest,
  signature,
  createdAt,
  service = SERVICE_NAME,
}: {
  messageId: string;
  digest: string;
  signature: string;
  createdAt: string;
  service?: string;
}): Receipt => ({
  messageId,
  digest,
  signature,
  createdAt,
  service,
  status: 'RECEIVED',
});

export const artifactIdToPath = (artifactId: string): { path: string; name: ArtifactName } => {
  const [messageId, name] = artifactId.split('--');
  if (!messageId || !name) {
    throw new Error('Invalid artifact id');
  }

  if (!/^[a-zA-Z0-9-]+$/.test(messageId)) {
    throw new Error('Invalid artifact id');
  }

  if (!Object.hasOwn(ARTIFACT_FILENAMES, name)) {
    throw new Error('Invalid artifact id');
  }

  const artifactName = name as ArtifactName;
  const resolvedPath = path.resolve(ARTIFACT_ROOT, messageId, ARTIFACT_FILENAMES[artifactName]);

  if (!resolvedPath.startsWith(path.resolve(ARTIFACT_ROOT))) {
    throw new Error('Invalid artifact path');
  }

  return { path: resolvedPath, name: artifactName };
};

export const persistArtifacts = async ({
  messageId,
  envelope,
  digest,
  receipt,
  signature,
}: PersistArtifactsOptions): Promise<ArtifactRecord> => {
  await ensureArtifactRoot();
  const messageDir = path.resolve(ARTIFACT_ROOT, messageId);
  await fs.mkdir(messageDir, { recursive: true });

  const files: Array<[ArtifactName, string]> = [
    ['envelope', envelope],
    ['digest', `${digest}\n`],
    ['receipt', `${JSON.stringify(receipt, null, 2)}\n`],
    ['messageId', `${messageId}\n`],
    ['signature', `${signature}\n`],
  ];

  await Promise.all(
    files.map(async ([name, content]) => {
      const filePath = path.join(messageDir, ARTIFACT_FILENAMES[name]);
      await fs.writeFile(filePath, content, 'utf-8');
    }),
  );

  return files.reduce<ArtifactRecord>((acc, [name]) => {
    acc[name] = `${messageId}--${name}`;
    return acc;
  }, {} as ArtifactRecord);
};

export const getArtifactContentType = (name: ArtifactName): string => ARTIFACT_CONTENT_TYPES[name];
