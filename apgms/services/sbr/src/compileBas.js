import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LABELS_FILE = path.resolve(__dirname, '../../../../rules/bas/labels_v1.json');

let cachedDefinitions;

function loadDefinitions() {
  if (!cachedDefinitions) {
    const raw = readFileSync(LABELS_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.labels)) {
      throw new Error('Invalid BAS label definition file');
    }

    cachedDefinitions = {
      version: parsed.version ?? '1.0.0',
      labels: parsed.labels.map((label) => ({
        code: label.code,
        description: label.description ?? '',
        source: label.source,
        field: label.field
      }))
    };
  }

  return cachedDefinitions;
}

function normaliseAmount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function roundToWholeDollar(value) {
  const numeric = normaliseAmount(value);
  const absolute = Math.abs(numeric);
  const integer = Math.floor(absolute);
  const fraction = absolute - integer;
  const rounded = fraction >= 0.5 ? integer + 1 : integer;
  return numeric < 0 ? -rounded : rounded;
}

export function compileBas(period, gstResult = {}, paygwResult = {}) {
  if (!period) {
    throw new Error('A BAS period must be provided');
  }

  const { version, labels } = loadDefinitions();
  const compiled = {};

  for (const definition of labels) {
    const sourceData = definition.source === 'gst' ? gstResult : paygwResult;
    const rawAmount = normaliseAmount(sourceData?.[definition.field]);
    compiled[definition.code] = {
      code: definition.code,
      description: definition.description,
      rawAmount,
      amount: roundToWholeDollar(rawAmount)
    };
  }

  return {
    version,
    period,
    labels: compiled
  };
}

export const __testing = {
  roundToWholeDollar,
  loadDefinitions
};
