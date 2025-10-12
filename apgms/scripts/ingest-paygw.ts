import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface RawPaygwRow {
  frequency: PayFrequency;
  lower: number;
  upper: number | null;
  rate: number;
  intercept: number;
  notes?: string;
}

export type NormalisedFormula =
  | { kind: 'constant'; amount: number }
  | { kind: 'linear'; rate: number; intercept: number; rounding: 'nearest-dollar' };

export interface NormalisedThreshold {
  lower: number;
  upper: number | null;
  formula: NormalisedFormula;
  notes?: string;
}

export interface PaygwPackMetadata {
  frequency: PayFrequency;
  effectiveFrom: string;
  source: string;
  url?: string;
  digest?: string;
  generatedAt: string;
}

export interface PaygwPack {
  metadata: PaygwPackMetadata;
  thresholds: NormalisedThreshold[];
}

export interface IngestOptions {
  effectiveFrom: string;
  source: string;
  url?: string;
  digest?: string;
  sourcePath?: string;
  outputDir?: string;
}

const REQUIRED_COLUMNS = ['frequency', 'lower', 'upper', 'rate', 'intercept'];

function parseAmount(value: string): number {
  const cleaned = value
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .replace(/\$/g, '')
    .replace(/,/g, '');
  if (!cleaned) {
    return NaN;
  }
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse numeric value: "${value}"`);
  }
  return parsed;
}

function parseFrequency(value: string): PayFrequency {
  const normalised = value.trim().toLowerCase();
  if (normalised !== 'weekly' && normalised !== 'fortnightly' && normalised !== 'monthly') {
    throw new Error(`Unsupported frequency "${value}". Expected weekly, fortnightly or monthly.`);
  }
  return normalised;
}

export function parsePaygwCsv(text: string): RawPaygwRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) {
    return [];
  }

  const header = lines[0]
    .split(',')
    .map((column) => column.trim().toLowerCase());

  for (const column of REQUIRED_COLUMNS) {
    if (!header.includes(column)) {
      throw new Error(`Missing required column "${column}" in PAYGW table.`);
    }
  }

  const columnIndex = Object.fromEntries(header.map((name, index) => [name, index]));

  const rows: RawPaygwRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split(',');
    const frequency = parseFrequency(cells[columnIndex.frequency] ?? '');
    const lowerCell = cells[columnIndex.lower] ?? '';
    const upperCell = cells[columnIndex.upper] ?? '';
    const rateCell = cells[columnIndex.rate] ?? '';
    const interceptCell = cells[columnIndex.intercept] ?? '';
    const notesCell = columnIndex.notes !== undefined ? cells[columnIndex.notes] ?? '' : '';

    const lower = parseAmount(lowerCell);
    const upper = upperCell.trim() ? parseAmount(upperCell) : null;
    const rate = rateCell.trim() ? parseAmount(rateCell) : 0;
    const intercept = interceptCell.trim() ? parseAmount(interceptCell) : 0;

    if (Number.isNaN(lower)) {
      throw new Error(`Row ${i + 1}: invalid lower threshold value "${lowerCell}".`);
    }
    if (upper !== null && Number.isNaN(upper)) {
      throw new Error(`Row ${i + 1}: invalid upper threshold value "${upperCell}".`);
    }
    if (Number.isNaN(rate)) {
      throw new Error(`Row ${i + 1}: invalid rate value "${rateCell}".`);
    }
    if (Number.isNaN(intercept)) {
      throw new Error(`Row ${i + 1}: invalid intercept value "${interceptCell}".`);
    }

    rows.push({
      frequency,
      lower,
      upper,
      rate,
      intercept,
      notes: notesCell?.trim()
        ? notesCell.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
        : undefined,
    });
  }

  return rows;
}

export function buildPaygwPacks(rows: RawPaygwRow[], options: IngestOptions): Map<PayFrequency, PaygwPack> {
  const packs = new Map<PayFrequency, PaygwPack>();

  for (const row of rows) {
    if (!packs.has(row.frequency)) {
      packs.set(row.frequency, {
        metadata: {
          frequency: row.frequency,
          effectiveFrom: options.effectiveFrom,
          source: options.source,
          url: options.url,
          digest: options.digest,
          generatedAt: new Date().toISOString(),
        },
        thresholds: [],
      });
    }

    const pack = packs.get(row.frequency)!;

    const formula: NormalisedFormula = row.rate === 0
      ? { kind: 'constant', amount: Math.round(row.intercept) }
      : { kind: 'linear', rate: row.rate, intercept: row.intercept, rounding: 'nearest-dollar' };

    pack.thresholds.push({
      lower: row.lower,
      upper: row.upper,
      formula,
      notes: row.notes,
    });
  }

  // Sort thresholds by lower bound for determinism
  for (const pack of packs.values()) {
    pack.thresholds.sort((a, b) => a.lower - b.lower);
  }

  return packs;
}

export function evaluateWithholding(thresholds: NormalisedThreshold[], gross: number): number {
  const bracket = thresholds.find((row) => gross >= row.lower && (row.upper === null || gross <= row.upper));
  if (!bracket) {
    throw new Error(`Unable to locate threshold for gross amount ${gross}.`);
  }

  if (bracket.formula.kind === 'constant') {
    return bracket.formula.amount;
  }

  const raw = bracket.formula.rate * gross + bracket.formula.intercept;
  return Math.round(raw);
}

export function writePaygwPacks(packs: Map<PayFrequency, PaygwPack>, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [frequency, pack] of packs.entries()) {
    const effectiveDate = pack.metadata.effectiveFrom;
    const filename = `${effectiveDate}_${frequency}.json`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(pack, null, 2));
  }
}

function resolveOutputDir(customOutputDir?: string): string {
  if (customOutputDir) {
    return path.resolve(customOutputDir);
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, '..', 'rules', 'paygw');
}

function readSource(options: IngestOptions): string {
  if (options.sourcePath) {
    return fs.readFileSync(options.sourcePath, 'utf-8');
  }
  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, 'utf-8');
  }
  throw new Error('No PAYGW table provided. Use --input <file> or pipe data via STDIN.');
}

export function parseArgs(argv: string[]): IngestOptions {
  const args = argv.slice(2);
  const options: Partial<IngestOptions> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument "${arg}". Expected CLI flags.`);
    }

    const value = args[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Flag "${arg}" requires a value.`);
    }
    i += 1;

    switch (arg) {
      case '--effective-from':
        options.effectiveFrom = value;
        break;
      case '--source':
        options.source = value;
        {
          const candidatePath = path.resolve(value);
          if (fs.existsSync(candidatePath)) {
            options.sourcePath = candidatePath;
          }
        }
        break;
      case '--url':
        options.url = value;
        break;
      case '--digest':
        options.digest = value;
        break;
      case '--input':
        options.sourcePath = path.resolve(value);
        break;
      case '--output':
        options.outputDir = value;
        break;
      default:
        throw new Error(`Unknown flag "${arg}".`);
    }
  }

  if (!options.effectiveFrom) {
    throw new Error('Missing required flag --effective-from.');
  }
  if (!options.source) {
    throw new Error('Missing required flag --source.');
  }
  if (!options.sourcePath && fs.existsSync(path.resolve(options.source))) {
    options.sourcePath = path.resolve(options.source);
  }

  return options as IngestOptions;
}

export function runCli(argv = process.argv): void {
  try {
    const options = parseArgs(argv);
    const tableText = readSource(options);
    const rows = parsePaygwCsv(tableText);
    const packs = buildPaygwPacks(rows, options);
    const outputDir = resolveOutputDir(options.outputDir);
    writePaygwPacks(packs, outputDir);
    for (const frequency of packs.keys()) {
      // eslint-disable-next-line no-console
      console.log(`Generated PAYGW pack for ${frequency} at ${options.effectiveFrom}.`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const isCliInvocation = () => {
  if (!process.argv[1]) {
    return false;
  }
  const modulePath = fileURLToPath(import.meta.url);
  return modulePath === path.resolve(process.argv[1]);
};

if (isCliInvocation()) {
  runCli();
}
