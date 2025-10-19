import { promises as fs } from 'node:fs';
import path from 'node:path';
import manifests from '../services/connectors/connectors.json';

type ConnectorManifest = { id: string };

type AttestationRecord = {
  vendor?: unknown;
  data_categories?: unknown;
  auth?: unknown;
  storage?: unknown;
  risks?: unknown;
  mitigations?: unknown;
  status?: unknown;
  [key: string]: unknown;
};

const requiredFields = [
  'vendor',
  'data_categories',
  'auth',
  'storage',
  'risks',
  'mitigations',
  'status',
] as const;

type RequiredField = (typeof requiredFields)[number];

const arrayFields: RequiredField[] = ['data_categories', 'risks', 'mitigations'];

const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs', 'suppliers');

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseAttestation(raw: string): AttestationRecord {
  const record: AttestationRecord = {};
  let currentArray: RequiredField | null = null;

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    if (/^\s+-/.test(line)) {
      if (!currentArray) {
        throw new Error('Array item defined without a field header');
      }
      const value = line.replace(/^\s+-\s*/, '');
      const entry = unquote(value);
      if (!record[currentArray]) {
        record[currentArray] = [];
      }
      (record[currentArray] as unknown[]).push(entry);
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) {
      throw new Error(`Unable to parse line: ${line}`);
    }

    const [, key, remainder] = match;
    const field = key as RequiredField;
    currentArray = null;

    if (remainder === '') {
      if (!arrayFields.includes(field)) {
        throw new Error(`Field "${key}" is not configured to accept array values`);
      }
      record[field] = [];
      currentArray = field;
      continue;
    }

    record[field] = unquote(remainder);
  }

  return record;
}

async function main() {
  const errors: string[] = [];
  const connectors = (manifests as ConnectorManifest[]).filter((connector) => connector.id);
  const seen = new Set<string>();

  for (const connector of connectors) {
    if (!connector.id || typeof connector.id !== 'string') {
      errors.push('Connector manifest is missing a string "id" field.');
      continue;
    }

    if (seen.has(connector.id)) {
      errors.push(`Duplicate connector id detected: ${connector.id}`);
      continue;
    }

    seen.add(connector.id);

    const attestationPath = path.join(docsDir, `${connector.id}.yaml`);
    let raw: string;
    try {
      raw = await fs.readFile(attestationPath, 'utf8');
    } catch (error) {
      errors.push(`Missing attestation file for connector "${connector.id}" at ${path.relative(repoRoot, attestationPath)}`);
      continue;
    }

    let parsed: AttestationRecord;
    try {
      parsed = parseAttestation(raw);
    } catch (error) {
      errors.push(`Failed to parse attestation for connector "${connector.id}": ${(error as Error).message}`);
      continue;
    }

    for (const field of requiredFields) {
      const value = parsed[field];

      if (value === undefined || value === null) {
        errors.push(`Connector "${connector.id}" is missing required field "${field}".`);
        continue;
      }

      if (typeof value === 'string') {
        if (value.trim().length === 0) {
          errors.push(`Connector "${connector.id}" has empty string for field "${field}".`);
        }
        continue;
      }

      if (arrayFields.includes(field)) {
        if (!Array.isArray(value) || value.length === 0) {
          errors.push(`Connector "${connector.id}" must provide a non-empty array for field "${field}".`);
        } else if (value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
          errors.push(`Connector "${connector.id}" has invalid entries in array field "${field}".`);
        }
        continue;
      }

      errors.push(`Connector "${connector.id}" has unsupported type for field "${field}".`);
    }
  }

  if (connectors.length === 0) {
    errors.push('No connectors are registered in services/connectors/connectors.json.');
  }

  if (errors.length > 0) {
    console.error('Supplier attestation lint failed:\n');
    for (const message of errors) {
      console.error(` - ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Supplier attestation lint passed for connectors:', Array.from(seen).join(', '));
}

void main();
