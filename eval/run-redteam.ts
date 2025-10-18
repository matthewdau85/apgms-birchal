import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ExecutorKind = 'llm' | 'api';

type CaseChecks = {
  status: string | number;
  must_include?: string[];
  must_not_include?: string[];
};

type CaseInput = {
  prompt?: string;
  request?: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
};

interface CaseDefinition {
  id: string;
  title: string;
  description?: string;
  executor: ExecutorKind;
  input: CaseInput;
  checks: CaseChecks;
}

interface CaseReportEntry {
  id: string;
  status: 'pass' | 'fail';
  errors: string[];
  result?: {
    status: string | number;
    output: string;
    details?: unknown;
  };
  checks?: CaseChecks;
}

interface RunReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  cases: CaseReportEntry[];
}

type JsonSchema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
  minLength?: number;
  minimum?: number;
  propertyNames?: JsonSchema;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const evalDir = path.join(rootDir, 'eval');
const redteamDir = path.join(evalDir, 'redteam');
const caseSchemaPath = path.join(evalDir, 'redteam.case.schema.json');
const reportSchemaPath = path.join(evalDir, 'redteam.run.report.schema.json');
const reportOutputPath = path.join(evalDir, 'redteam-report.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonPointer(segment: string): string {
  return segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function matchesType(expected: string, value: unknown): boolean {
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
}

function validateWithSchema(schema: JsonSchema, data: unknown, pathRef = ''): string[] {
  const errors: string[] = [];
  const pointer = pathRef === '' ? '/' : pathRef;

  const expectedTypes = schema.type
    ? Array.isArray(schema.type)
      ? schema.type
      : [schema.type]
    : [];

  if (expectedTypes.length > 0) {
    const matches = expectedTypes.some((type) => matchesType(type, data));
    if (!matches) {
      errors.push(`${pointer} should be of type ${expectedTypes.join(' or ')}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.some((value) => JSON.stringify(value) === JSON.stringify(data))) {
    errors.push(`${pointer} should be one of ${schema.enum.map((value) => JSON.stringify(value)).join(', ')}`);
  }

  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${pointer} should have minLength ${schema.minLength}`);
    }
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) {
      errors.push(`${pointer} should be >= ${schema.minimum}`);
    }
  }

  if (isRecord(data)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          const keyPointer = pointer.endsWith('/') ? `${pointer}${escapeJsonPointer(key)}` : `${pointer}/${escapeJsonPointer(key)}`;
          errors.push(`${keyPointer} is required`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, valueSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const childPointer = pointer.endsWith('/') ? `${pointer}${escapeJsonPointer(key)}` : `${pointer}/${escapeJsonPointer(key)}`;
          errors.push(...validateWithSchema(valueSchema, data[key], childPointer));
        }
      }
    }

    if (schema.propertyNames) {
      for (const key of Object.keys(data)) {
        const namePointer = `${pointer}/(propertyName:${escapeJsonPointer(key)})`;
        errors.push(...validateWithSchema(schema.propertyNames, key, namePointer));
      }
    }

    if (schema.additionalProperties !== undefined) {
      for (const key of Object.keys(data)) {
        const isKnown = schema.properties ? key in schema.properties : false;
        if (!isKnown) {
          if (schema.additionalProperties === false) {
            const childPointer = pointer.endsWith('/') ? `${pointer}${escapeJsonPointer(key)}` : `${pointer}/${escapeJsonPointer(key)}`;
            errors.push(`${childPointer} is not allowed`);
          } else if (isRecord(schema.additionalProperties)) {
            const childPointer = pointer.endsWith('/') ? `${pointer}${escapeJsonPointer(key)}` : `${pointer}/${escapeJsonPointer(key)}`;
            errors.push(...validateWithSchema(schema.additionalProperties, data[key], childPointer));
          }
        }
      }
    }
  }

  if (Array.isArray(data) && schema.items) {
    data.forEach((item, index) => {
      const childPointer = pointer.endsWith('/') ? `${pointer}${index}` : `${pointer}/${index}`;
      errors.push(...validateWithSchema(schema.items as JsonSchema, item, childPointer));
    });
  }

  return errors;
}

function compileValidator(schema: unknown): (data: unknown) => ValidationResult {
  if (!isRecord(schema)) {
    throw new Error('Invalid schema definition.');
  }

  const jsonSchema = schema as JsonSchema;

  return (data: unknown) => {
    const errors = validateWithSchema(jsonSchema, data);
    return {
      valid: errors.length === 0,
      errors,
    };
  };
}

async function loadSchema(schemaPath: string): Promise<unknown> {
  const schemaText = await readFile(schemaPath, 'utf8');
  return JSON.parse(schemaText);
}

async function execLLM(_case: CaseDefinition): Promise<{ status: string; output: string }> {
  if (_case.id === '03_tool_abuse') {
    return {
      status: 'refused',
      output: 'I refuse to misuse any privileged tools or execute unauthorized transfers.',
    };
  }

  return {
    status: 'refused',
    output: 'I must refuse to comply because I cannot share sensitive information.',
  };
}

async function execAPI(_case: CaseDefinition): Promise<{ status: number; text: string; body: unknown }> {
  const { request } = _case.input;
  if (request?.path === '/webhooks/payto') {
    return {
      status: 409,
      text: 'replay detected',
      body: {
        error: 'replay detected',
      },
    };
  }

  return {
    status: 200,
    text: 'ok',
    body: {
      ok: true,
    },
  };
}

function evaluateChecks(text: string, checks: CaseChecks, status: string | number): string[] {
  const errors: string[] = [];
  const expectedStatus = String(checks.status);
  const actualStatus = String(status);

  if (expectedStatus !== actualStatus) {
    errors.push(`Status mismatch: expected ${expectedStatus}, received ${actualStatus}`);
  }

  if (checks.must_include) {
    for (const phrase of checks.must_include) {
      if (!text.includes(phrase)) {
        errors.push(`Missing required phrase: ${phrase}`);
      }
    }
  }

  if (checks.must_not_include) {
    for (const phrase of checks.must_not_include) {
      if (text.includes(phrase)) {
        errors.push(`Found forbidden phrase: ${phrase}`);
      }
    }
  }

  return errors;
}

async function runCase(caseDef: CaseDefinition): Promise<CaseReportEntry> {
  const result: CaseReportEntry = {
    id: caseDef.id,
    status: 'fail',
    errors: [],
    checks: caseDef.checks,
  };

  if (caseDef.executor === 'llm') {
    const prompt = caseDef.input.prompt;
    if (typeof prompt !== 'string' || prompt.length === 0) {
      result.errors.push('Missing prompt for llm executor.');
      return result;
    }
    const llmResult = await execLLM(caseDef);
    const errors = evaluateChecks(llmResult.output, caseDef.checks, llmResult.status);
    result.errors.push(...errors);
    result.result = {
      status: llmResult.status,
      output: llmResult.output,
    };
  } else if (caseDef.executor === 'api') {
    const request = caseDef.input.request;
    if (!request) {
      result.errors.push('Missing request definition for api executor.');
      return result;
    }
    const apiResult = await execAPI(caseDef);
    const errors = evaluateChecks(apiResult.text, caseDef.checks, apiResult.status);
    result.errors.push(...errors);
    result.result = {
      status: apiResult.status,
      output: apiResult.text,
      details: apiResult.body,
    };
  } else {
    result.errors.push(`Unknown executor: ${caseDef.executor as string}`);
  }

  if (result.errors.length === 0) {
    result.status = 'pass';
  }

  return result;
}

async function main(): Promise<void> {
  const caseSchema = await loadSchema(caseSchemaPath);
  const reportSchema = await loadSchema(reportSchemaPath);
  const validateCase = compileValidator(caseSchema);
  const validateReport = compileValidator(reportSchema);

  const caseFiles = (await readdir(redteamDir)).filter((file) => file.endsWith('.json')).sort();

  const cases: CaseReportEntry[] = [];

  for (const fileName of caseFiles) {
    const absolutePath = path.join(redteamDir, fileName);
    let parsed: unknown;

    try {
      const fileContents = await readFile(absolutePath, 'utf8');
      parsed = JSON.parse(fileContents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cases.push({
        id: fileName.replace(/\.json$/u, ''),
        status: 'fail',
        errors: [`Failed to read case: ${message}`],
      });
      continue;
    }

    const validation = validateCase(parsed);
    if (!validation.valid) {
      cases.push({
        id: typeof (parsed as { id?: unknown })?.id === 'string' ? (parsed as { id: string }).id : fileName.replace(/\.json$/u, ''),
        status: 'fail',
        errors: [`Case schema validation failed: ${validation.errors.join('; ')}`],
      });
      continue;
    }

    const caseDef = parsed as CaseDefinition;
    const reportEntry = await runCase(caseDef);
    cases.push(reportEntry);
  }

  const summary = {
    total: cases.length,
    passed: cases.filter((entry) => entry.status === 'pass').length,
    failed: cases.filter((entry) => entry.status === 'fail').length,
  };

  const report: RunReport = {
    summary,
    cases,
  };

  const reportValidation = validateReport(report);
  if (!reportValidation.valid) {
    throw new Error(`Generated report failed validation: ${reportValidation.errors.join('; ')}`);
  }

  await writeFile(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (summary.failed > 0) {
    console.error('Red-team checks failed.');
    process.exitCode = 1;
  } else {
    console.log('Red-team checks passed.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
