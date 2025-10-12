import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const RULE_DOMAINS = [
  'gst',
  'paygw',
  'bas',
  'stp2',
  'ftc',
] as const;

export type RuleDomain = (typeof RULE_DOMAINS)[number];

export interface RulePackMeta {
  domain: RuleDomain;
  variant?: string;
  effective_from: string;
  effective_to?: string;
  source: string;
  schema_version: string;
}

export interface RulePack<TData> {
  meta: RulePackMeta;
  rules: TData;
}

type RawRulePack = RulePack<unknown>;

type DateTuple = [number, number, number];

const metaSchema = z.object({
  domain: z.enum(RULE_DOMAINS),
  variant: z
    .string()
    .min(1)
    .optional(),
  effective_from: z
    .string()
    .refine(isValidDateString, {
      message: 'must be an ISO-8601 date string',
    }),
  effective_to: z
    .string()
    .refine(isValidDateString, {
      message: 'must be an ISO-8601 date string',
    })
    .optional(),
  source: z.string().min(1, 'source cannot be empty'),
  schema_version: z.string().min(1, 'schema_version cannot be empty'),
});

const rulePackSchema = z.object({
  meta: metaSchema,
  rules: z.unknown(),
});

const DEFAULT_RULES_ROOT = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'rules',
);

export async function loadRulePack<TData = unknown>(
  domain: RuleDomain,
  date: string,
  variant?: string,
): Promise<RulePack<TData>> {
  const targetDate = parseDateOrThrow(date, 'date');
  const rulesRoot = process.env.APGMS_RULES_ROOT ?? DEFAULT_RULES_ROOT;
  const allPacks = await readAllRulePacks(rulesRoot);

  const candidates = allPacks.filter((pack) => pack.meta.domain === domain);
  const filteredByVariant = variant
    ? candidates.filter((pack) => pack.meta.variant === variant)
    : candidates;

  const activeOnDate = filteredByVariant.filter((pack) => {
    const from = parseDateOrThrow(pack.meta.effective_from, 'effective_from');
    const to = pack.meta.effective_to
      ? parseDateOrThrow(pack.meta.effective_to, 'effective_to')
      : undefined;

    return isDateInRange(targetDate, from, to);
  });

  const ordered = activeOnDate
    .slice()
    .sort((a, b) => compareDateTuples(
      parseDateTuple(b.meta.effective_from),
      parseDateTuple(a.meta.effective_from),
    ));

  const match = !variant
    ? ordered.find((pack) => pack.meta.variant === undefined) ?? ordered[0]
    : ordered[0];

  if (!match) {
    const variantMessage = variant ? ` and variant "${variant}"` : '';
    throw new Error(
      `No rule pack found for domain "${domain}"${variantMessage} on ${date}`,
    );
  }

  return match as RulePack<TData>;
}

async function readAllRulePacks(root: string): Promise<RawRulePackWithFile[]> {
  const filePaths = await listJsonFiles(root);
  const packs: RawRulePackWithFile[] = [];

  for (const filePath of filePaths) {
    const contents = await fs.readFile(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Failed to parse rule pack at ${filePath}: ${(error as Error).message}`);
    }

    const result = rulePackSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(buildValidationMessage(filePath, result.error.issues));
    }

    packs.push({ ...result.data, filePath });
  }

  return packs;
}

type RawRulePackWithFile = RawRulePack & { filePath: string };

async function listJsonFiles(root: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Rules directory not found at ${root}`);
    }

    throw error;
  }

  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      const nested = await listJsonFiles(fullPath);
      results.push(...nested);
    } else if (entry.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

function buildValidationMessage(filePath: string, issues: z.ZodIssue[]): string {
  const missingFields = new Set<string>();
  const otherIssues: string[] = [];

  for (const issue of issues) {
    const pathString = issue.path.join('.') || '<root>';
    const received = (issue as z.ZodInvalidTypeIssue).received;
    if (
      issue.code === 'invalid_type' &&
      (received === 'undefined' || received === undefined)
    ) {
      missingFields.add(pathString);
    } else {
      otherIssues.push(`${pathString}: ${issue.message}`);
    }
  }

  const parts: string[] = [];
  if (missingFields.size > 0) {
    parts.push(`missing fields: ${Array.from(missingFields).join(', ')}`);
  }
  if (otherIssues.length > 0) {
    parts.push(`validation errors: ${otherIssues.join('; ')}`);
  }

  return `Invalid rule pack at ${filePath}${parts.length ? ` (${parts.join(' | ')})` : ''}`;
}

function isValidDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function parseDateOrThrow(value: string, label: string): Date {
  if (!isValidDateString(value)) {
    throw new Error(`Invalid ${label} date: ${value}`);
  }

  return new Date(value + (value.endsWith('Z') || value.includes('T') ? '' : 'T00:00:00Z'));
}

function parseDateTuple(value: string): DateTuple {
  const date = parseDateOrThrow(value, 'meta date');
  return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
}

function compareDateTuples(a: DateTuple, b: DateTuple): number {
  for (let i = 0; i < 3; i += 1) {
    const diff = a[i] - b[i];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function isDateInRange(target: Date, from: Date, to?: Date): boolean {
  const targetTime = target.getTime();
  const fromTime = from.getTime();
  const toTime = to?.getTime();

  if (targetTime < fromTime) {
    return false;
  }

  if (typeof toTime === 'number' && targetTime > toTime) {
    return false;
  }

  return true;
}
