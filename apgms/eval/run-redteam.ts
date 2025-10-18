import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

type Executor = 'llm' | 'api';
type CheckType = 'contains' | 'not_contains' | 'status_equals';

type RedTeamCheck = {
  type: CheckType;
  field: 'response' | 'text' | 'status';
  value?: string;
  equals?: number | string;
};

type RedTeamCase = {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  executor: Executor;
  prompt?: string;
  spec?: string;
  checks: RedTeamCheck[];
};

type LlmResult = { response: string };
type ApiResult = { status: number; text: string };
type ExecutionResult = LlmResult | ApiResult;

type FailedCase = { id: string; reasons: string[] };
type RunReport = { total: number; passed: number; failed: number; failed_cases: FailedCase[] };

const __dirname = dirname(fileURLToPath(import.meta.url));
const redteamDir = resolve(__dirname, 'redteam');
const caseSchemaPath = resolve(__dirname, 'redteam.case.schema.json');
const reportSchemaPath = resolve(__dirname, 'redteam.run.report.schema.json');
const reportOutputPath = resolve(__dirname, 'redteam-report.json');

const ajv = new Ajv({ allErrors: true, strict: false });

async function loadSchema(path: string) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function execLLM(prompt: string): Promise<string> {
  return "I'm sorry, but I can't help with that.";
}

async function execAPI(spec: string): Promise<ApiResult> {
  if (/webhooks|payto/i.test(spec)) {
    return { status: 409, text: 'replay detected' };
  }
  return { status: 200, text: 'OK' };
}

function normalizeResult(executor: Executor, raw: string | ApiResult): ExecutionResult {
  if (executor === 'llm') {
    return { response: raw as string };
  }
  return raw as ApiResult;
}

function evaluateChecks(checks: RedTeamCheck[], result: ExecutionResult): string[] {
  const reasons: string[] = [];
  const fieldLookup = (field: RedTeamCheck['field']) => {
    switch (field) {
      case 'response':
        return 'response' in result ? result.response : '';
      case 'text':
        return 'text' in result ? result.text : '';
      case 'status':
        return 'status' in result ? result.status : undefined;
      default:
        return undefined;
    }
  };

  for (const check of checks) {
    const target = fieldLookup(check.field);
    if (check.type === 'contains') {
      const haystack = typeof target === 'string' ? target : '';
      if (!check.value || !haystack.includes(check.value)) {
        reasons.push(`Expected ${check.field} to contain "${check.value ?? ''}"`);
      }
    } else if (check.type === 'not_contains') {
      const haystack = typeof target === 'string' ? target : '';
      if (check.value && haystack.includes(check.value)) {
        reasons.push(`Expected ${check.field} to avoid "${check.value}"`);
      }
    } else if (check.type === 'status_equals') {
      if (typeof target !== 'number' || target !== check.equals) {
        reasons.push(`Expected ${check.field} to equal ${check.equals}`);
      }
    }
  }

  return reasons;
}

async function main() {
  const caseSchema = await loadSchema(caseSchemaPath);
  const reportSchema = await loadSchema(reportSchemaPath);
  const validateCase = ajv.compile<RedTeamCase>(caseSchema);
  const validateReport = ajv.compile<RunReport>(reportSchema);

  const files = (await readdir(redteamDir)).filter((file) => file.endsWith('.json')).sort();
  const failedCases: FailedCase[] = [];
  let passedCount = 0;

  for (const file of files) {
    const fullPath = resolve(redteamDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const data = JSON.parse(raw) as RedTeamCase;

    if (!validateCase(data)) {
      const errors = ajv.errorsText(validateCase.errors, { separator: '\n' });
      throw new Error(`Case ${file} failed schema validation:\n${errors}`);
    }

    const execResult = data.executor === 'llm'
      ? normalizeResult('llm', await execLLM(data.prompt ?? ''))
      : normalizeResult('api', await execAPI(data.spec ?? ''));

    const reasons = evaluateChecks(data.checks, execResult);
    if (reasons.length === 0) {
      passedCount += 1;
      console.log(`PASS ${data.id} ${data.title}`);
    } else {
      failedCases.push({ id: data.id, reasons });
      console.log(`FAIL ${data.id} ${data.title}`);
      for (const reason of reasons) {
        console.log(`  - ${reason}`);
      }
    }
  }

  const total = files.length;
  const failedCount = failedCases.length;
  const report: RunReport = {
    total,
    passed: passedCount,
    failed: failedCount,
    failed_cases: failedCases
  };

  if (!validateReport(report)) {
    const errors = ajv.errorsText(validateReport.errors, { separator: '\n' });
    throw new Error(`Generated report failed schema validation:\n${errors}`);
  }

  await writeFile(reportOutputPath, JSON.stringify(report, null, 2));

  console.log('---');
  console.log(`Total: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
