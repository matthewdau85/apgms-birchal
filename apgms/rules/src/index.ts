import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, ZodError, ZodIssueCode } from 'zod';

export type RuleDomain = 'gst' | 'paygw' | 'bas' | 'stp2' | 'ftc';

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
  data: TData;
}

interface LoadedPack<TData> extends RulePack<TData> {
  filePath: string;
}

const metaSchema = z.object({
  effective_from: z.string().min(1, 'effective_from is required'),
  effective_to: z.string().min(1).optional(),
  source: z.string().min(1, 'source is required'),
  schema_version: z.string().min(1, 'schema_version is required'),
  variant: z.string().min(1).optional(),
});

const rulePackSchema = z.object({
  meta: metaSchema,
  data: z.unknown(),
});

const moduleDir = fileURLToPath(new URL('.', import.meta.url));
const packageDir = path.resolve(moduleDir, '..');
const defaultRulesDir = path.resolve(packageDir, '../../rules');

function resolveRulesDir(): string {
  const configured = process.env.APGMS_RULES_DIR;
  return configured ? path.resolve(configured) : defaultRulesDir;
}

function parseDate(value: string, description: string, filePath: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value for ${description} in ${relativeToRules(filePath)}: ${value}`);
  }
  return parsed;
}

function relativeToRules(filePath: string): string {
  const base = resolveRulesDir();
  return path.relative(base, filePath) || path.basename(filePath);
}

async function collectJsonFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files;
}

function formatZodError(error: ZodError, filePath: string): Error {
  const missingFields = new Set<string>();
  for (const issue of error.issues) {
    if (issue.code === ZodIssueCode.invalid_type) {
      const message = issue.message.toLowerCase();
      if (message.includes('required') || message.includes('received undefined')) {
        missingFields.add(issue.path.join('.'));
      }
    } else if (issue.code === 'too_small' && issue.minimum === 1) {
      missingFields.add(issue.path.join('.'));
    }
  }

  const relativePath = relativeToRules(filePath);
  if (missingFields.size > 0) {
    return new Error(
      `Invalid rule pack ${relativePath}: missing fields ${Array.from(missingFields).join(', ')}`,
    );
  }
  return new Error(`Invalid rule pack ${relativePath}: ${error.message}`);
}

async function loadPackFromFile<TData>(
  domain: RuleDomain,
  filePath: string,
): Promise<LoadedPack<TData>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Unable to read rule pack ${relativeToRules(filePath)}: ${(error as Error).message}`);
  }

  let parsed: z.infer<typeof rulePackSchema>;
  try {
    parsed = rulePackSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Unable to parse rule pack ${relativeToRules(filePath)}: ${error.message}`);
    }
    if (error instanceof ZodError) {
      throw formatZodError(error, filePath);
    }
    throw error;
  }

  const meta: RulePackMeta = {
    domain,
    ...parsed.meta,
  };

  return {
    meta,
    data: parsed.data as TData,
    filePath,
  };
}

function pickBestMatch<TData>(
  packs: LoadedPack<TData>[],
  targetDate: Date,
  variant?: string,
): LoadedPack<TData> {
  const subset = variant
    ? packs.filter((pack) => pack.meta.variant === variant)
    : packs.filter((pack) => !pack.meta.variant);

  if (variant && subset.length === 0) {
    throw new Error(`No rule packs found for domain ${packs[0]?.meta.domain ?? 'unknown'} and variant ${variant}`);
  }

  const candidates = (subset.length > 0 ? subset : packs).filter((pack) => {
    const start = parseDate(pack.meta.effective_from, 'meta.effective_from', pack.filePath);
    const end = pack.meta.effective_to
      ? parseDate(pack.meta.effective_to, 'meta.effective_to', pack.filePath)
      : undefined;

    return start <= targetDate && (!end || end >= targetDate);
  });

  if (candidates.length === 0) {
    const domain = packs[0]?.meta.domain ?? 'unknown';
    throw new Error(`No rule pack effective for ${domain} on ${targetDate.toISOString().slice(0, 10)}`);
  }

  candidates.sort((a, b) => {
    const aDate = parseDate(a.meta.effective_from, 'meta.effective_from', a.filePath).getTime();
    const bDate = parseDate(b.meta.effective_from, 'meta.effective_from', b.filePath).getTime();
    return bDate - aDate;
  });

  return candidates[0];
}

export async function loadRulePack<TData = unknown>(
  domain: RuleDomain,
  date: string,
  variant?: string,
): Promise<RulePack<TData>> {
  const rulesDir = resolveRulesDir();
  const domainDir = path.join(rulesDir, domain);

  const targetDate = parseDate(date, 'date', domainDir);
  const files = await collectJsonFiles(domainDir);

  if (files.length === 0) {
    throw new Error(`No rule packs available for domain ${domain}`);
  }

  const packs = await Promise.all(files.map((file) => loadPackFromFile<TData>(domain, file)));
  const best = pickBestMatch(packs, targetDate, variant);

  return {
    meta: best.meta,
    data: best.data,
  };
}

export async function listRulePacks<TData = unknown>(domain: RuleDomain): Promise<RulePack<TData>[]> {
  const rulesDir = resolveRulesDir();
  const domainDir = path.join(rulesDir, domain);
  const files = await collectJsonFiles(domainDir);
  const packs = await Promise.all(files.map((file) => loadPackFromFile<TData>(domain, file)));
  return packs.map(({ filePath: _filePath, ...pack }) => pack);
}
