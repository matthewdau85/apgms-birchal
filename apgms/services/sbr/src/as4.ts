import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface As4Config {
  service: string;
  action: string;
  from: string;
  to: string;
  messageIdSeed?: string;
  createdAt?: string;
}

export interface As4Envelope {
  messageId: string;
  service: string;
  action: string;
  parties: {
    from: string;
    to: string;
  };
  payload: unknown;
  payloadDigest: string;
  createdAt: string;
}

export interface As4Receipt {
  messageId: string;
  signature: string;
  algorithm: 'sha256';
  keyId: string;
}

const DEFAULT_TIMESTAMP = '1970-01-01T00:00:00.000Z';

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = normalize(val);
        return acc;
      }, {});
  }

  return value;
};

const stableStringify = (value: unknown): string => JSON.stringify(normalize(value));

const createHashFrom = (...parts: string[]): string => {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest('hex');
};

export const buildEnvelope = (payload: unknown, cfg: As4Config): As4Envelope => {
  const payloadRepresentation = stableStringify(payload);
  const payloadDigest = createHashFrom(payloadRepresentation);
  const messageIdSource = cfg.messageIdSeed ?? `${cfg.service}:${cfg.action}:${cfg.from}:${cfg.to}:${payloadDigest}`;
  const messageId = `as4-${createHashFrom(messageIdSource)}`;

  return {
    messageId,
    service: cfg.service,
    action: cfg.action,
    parties: {
      from: cfg.from,
      to: cfg.to,
    },
    payload,
    payloadDigest,
    createdAt: cfg.createdAt ?? DEFAULT_TIMESTAMP,
  };
};

export const signEnvelope = (envelope: As4Envelope, key: string): As4Receipt => {
  const envelopeSummary = stableStringify({
    messageId: envelope.messageId,
    service: envelope.service,
    action: envelope.action,
    parties: envelope.parties,
    payloadDigest: envelope.payloadDigest,
  });

  const signature = createHashFrom(envelopeSummary, key);
  const keyId = createHashFrom(key).slice(0, 16);

  return {
    messageId: envelope.messageId,
    signature,
    algorithm: 'sha256',
    keyId,
  };
};

type PersistArtifactsInput = {
  envelope: As4Envelope;
  receipt: As4Receipt;
  directory?: string;
};

type PersistArtifactsResult = {
  envelopePath: string;
  receiptPath: string;
};

const defaultDirectory = path.resolve(process.cwd(), 'tmp');

const safeBasename = (messageId: string): string => messageId.replace(/[^a-zA-Z0-9_-]/g, '_');

export const persistArtifacts = async ({
  envelope,
  receipt,
  directory = defaultDirectory,
}: PersistArtifactsInput): Promise<PersistArtifactsResult> => {
  await fs.mkdir(directory, { recursive: true });

  const base = safeBasename(envelope.messageId);
  const envelopePath = path.join(directory, `${base}-envelope.json`);
  const receiptPath = path.join(directory, `${base}-receipt.json`);

  await fs.writeFile(envelopePath, JSON.stringify(envelope, null, 2), 'utf-8');
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), 'utf-8');

  return { envelopePath, receiptPath };
};
