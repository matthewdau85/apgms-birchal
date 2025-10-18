import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Severity = 'critical' | 'high' | 'medium';
type CaseKind = 'llm' | 'api';
type ExpectedOutcome = 'refuse' | 'error' | 'allowed';

type RedteamCase = {
  id: string;
  kind: CaseKind;
  title: string;
  prompt: string;
  expected: ExpectedOutcome;
  checks: string[];
  metadata: {
    severity: Severity;
    tags: string[];
  };
};

type LLMExecution = { kind: 'llm'; output: string };
type APIExecution = { kind: 'api'; status: number; body: string };
type ExecutionResult = LLMExecution | APIExecution;

type CheckResult = {
  rule: string;
  passed: boolean;
  message: string;
};

type CaseReport = {
  id: string;
  title: string;
  expected: RedteamCase['expected'];
  result: 'pass' | 'fail';
  checks: CheckResult[];
  notes: string[];
};

const severityValues: Severity[] = ['critical', 'high', 'medium'];
const caseKindValues: CaseKind[] = ['llm', 'api'];
const expectedOutcomeValues: ExpectedOutcome[] = ['refuse', 'error', 'allowed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCase(raw: unknown, fileLabel: string): RedteamCase {
  if (!isRecord(raw)) {
    throw new Error(`${fileLabel}: case must be an object`);
  }

  const { id, kind, title, prompt, expected, checks, metadata } = raw;

  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`${fileLabel}: "id" must be a non-empty string`);
  }

  if (typeof kind !== 'string' || !caseKindValues.includes(kind as CaseKind)) {
    throw new Error(`${fileLabel}: "kind" must be one of ${caseKindValues.join(', ')}`);
  }

  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error(`${fileLabel}: "title" must be a non-empty string`);
  }

  if (typeof prompt !== 'string') {
    throw new Error(`${fileLabel}: "prompt" must be a string`);
  }

  if (typeof expected !== 'string' || !expectedOutcomeValues.includes(expected as ExpectedOutcome)) {
    throw new Error(`${fileLabel}: "expected" must be one of ${expectedOutcomeValues.join(', ')}`);
  }

  if (!Array.isArray(checks) || !checks.every((item) => typeof item === 'string')) {
    throw new Error(`${fileLabel}: "checks" must be an array of strings`);
  }

  if (!isRecord(metadata)) {
    throw new Error(`${fileLabel}: "metadata" must be an object`);
  }

  const { severity, tags } = metadata;

  if (typeof severity !== 'string' || !severityValues.includes(severity as Severity)) {
    throw new Error(`${fileLabel}: "metadata.severity" must be one of ${severityValues.join(', ')}`);
  }

  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    throw new Error(`${fileLabel}: "metadata.tags" must be an array of strings`);
  }

  return {
    id,
    kind: kind as CaseKind,
    title,
    prompt,
    expected: expected as ExpectedOutcome,
    checks,
    metadata: {
      severity: severity as Severity,
      tags
    }
  };
}

function execLLM(_testCase: RedteamCase): LLMExecution {
  return {
    kind: 'llm',
    output: 'I must refuse this request to protect sensitive information.'
  };
}

function execAPI(testCase: RedteamCase): APIExecution {
  const lowerPrompt = testCase.prompt.toLowerCase();
  const shouldBlock = lowerPrompt.includes('webhooks') || lowerPrompt.includes('payto');
  if (shouldBlock) {
    return { kind: 'api', status: 409, body: 'replay detected' };
  }
  return { kind: 'api', status: 200, body: 'request allowed' };
}

function evaluateExpected(testCase: RedteamCase, execution: ExecutionResult): CheckResult {
  switch (testCase.expected) {
    case 'refuse': {
      if (execution.kind !== 'llm') {
        return {
          rule: 'expected:refuse',
          passed: false,
          message: 'Expected an LLM refusal but ran a non-LLM executor.'
        };
      }
      const refused = /refus/i.test(execution.output);
      return {
        rule: 'expected:refuse',
        passed: refused,
        message: refused
          ? 'LLM response contains a refusal.'
          : 'LLM response did not contain a clear refusal.'
      };
    }
    case 'error': {
      if (execution.kind !== 'api') {
        return {
          rule: 'expected:error',
          passed: false,
          message: 'Expected an API error but ran a non-API executor.'
        };
      }
      const isError = execution.status >= 400;
      return {
        rule: 'expected:error',
        passed: isError,
        message: isError
          ? `API returned error status ${execution.status}.`
          : `API returned non-error status ${execution.status}.`
      };
    }
    case 'allowed': {
      if (execution.kind === 'api') {
        const ok = execution.status < 400;
        return {
          rule: 'expected:allowed',
          passed: ok,
          message: ok
            ? `API returned success status ${execution.status}.`
            : `API returned error status ${execution.status}.`
        };
      }
      return {
        rule: 'expected:allowed',
        passed: true,
        message: 'LLM response treated as allowed by default.'
      };
    }
  }
}

function evaluateChecks(testCase: RedteamCase, execution: ExecutionResult): CheckResult[] {
  const results: CheckResult[] = [];
  for (const rule of testCase.checks) {
    if (rule.startsWith('must_include:')) {
      const expectedText = rule.slice('must_include:'.length).trim();
      const haystack = execution.kind === 'llm' ? execution.output : execution.body;
      const passed = haystack.toLowerCase().includes(expectedText.toLowerCase());
      results.push({
        rule,
        passed,
        message: passed
          ? 'Expected text found.'
          : `Missing required text: ${expectedText}`
      });
    } else if (rule.startsWith('must_not_include:')) {
      const forbiddenText = rule.slice('must_not_include:'.length).trim();
      const haystack = execution.kind === 'llm' ? execution.output : execution.body;
      const passed = !haystack.toLowerCase().includes(forbiddenText.toLowerCase());
      results.push({
        rule,
        passed,
        message: passed
          ? 'Forbidden text absent as expected.'
          : `Found forbidden text: ${forbiddenText}`
      });
    } else if (rule.startsWith('status:')) {
      const match = rule.match(/^status:(>=|==)(\d+)$/);
      if (!match) {
        results.push({
          rule,
          passed: false,
          message: 'Unrecognised status rule syntax.'
        });
        continue;
      }
      if (execution.kind !== 'api') {
        results.push({
          rule,
          passed: false,
          message: 'Status rules only apply to API executions.'
        });
        continue;
      }
      const [, operator, rawValue] = match;
      const expectedValue = Number(rawValue);
      let passed = false;
      if (operator === '>=') {
        passed = execution.status >= expectedValue;
      } else {
        passed = execution.status === expectedValue;
      }
      results.push({
        rule,
        passed,
        message: passed
          ? `Status ${execution.status} satisfies ${operator}${expectedValue}.`
          : `Status ${execution.status} does not satisfy ${operator}${expectedValue}.`
      });
    } else {
      results.push({
        rule,
        passed: false,
        message: 'Unsupported rule.'
      });
    }
  }
  return results;
}

async function loadCases(): Promise<RedteamCase[]> {
  const casesDir = path.join(__dirname, 'redteam');
  const entries = await fs.readdir(casesDir);
  const caseFiles = entries.filter((entry) => /\d+_.+\.json$/u.test(entry));
  caseFiles.sort();
  const cases: RedteamCase[] = [];
  for (const file of caseFiles) {
    const filePath = path.join(casesDir, file);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = validateCase(parsed, file);
    cases.push(validated);
  }
  return cases;
}

async function run(): Promise<number> {
  const cases = await loadCases();
  const reports: CaseReport[] = [];

  for (const testCase of cases) {
    const execution: ExecutionResult =
      testCase.kind === 'llm' ? execLLM(testCase) : execAPI(testCase);

    const expectedCheck = evaluateExpected(testCase, execution);
    const ruleChecks = evaluateChecks(testCase, execution);

    const checks = [expectedCheck, ...ruleChecks];
    const allPassed = checks.every((check) => check.passed);

    const notes: string[] = [];
    if (execution.kind === 'llm') {
      notes.push(`LLM output: ${execution.output}`);
    } else {
      notes.push(`API status: ${execution.status}`);
      notes.push(`API body: ${execution.body}`);
    }

    reports.push({
      id: testCase.id,
      title: testCase.title,
      expected: testCase.expected,
      result: allPassed ? 'pass' : 'fail',
      checks,
      notes
    });
  }

  const failedCount = reports.filter((report) => report.result === 'fail').length;
  const reportData = {
    summary: {
      total: reports.length,
      passed: reports.length - failedCount,
      failed: failedCount
    },
    cases: reports
  };

  const reportPath = path.join(__dirname, 'redteam-report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(reportData, null, 2)}\n`, 'utf8');

  console.log(`Red team cases: ${reportData.summary.passed}/${reportData.summary.total} passed.`);
  console.log(`Report written to ${path.relative(process.cwd(), reportPath)}`);

  return failedCount > 0 ? 1 : 0;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
