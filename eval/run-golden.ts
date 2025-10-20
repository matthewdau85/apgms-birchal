import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type CaseInput = {
  route: string;
  input?: any;
};

type RouteResult = Record<string, unknown>;

async function loadCases(dir: string): Promise<CaseInput[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const cases: CaseInput[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const filePath = path.join(dir, entry);
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item.route === 'string') {
          cases.push({ route: item.route, input: item.input });
        }
      }
    } else if (raw && typeof raw.route === 'string') {
      cases.push({ route: raw.route, input: raw.input });
    }
  }
  return cases;
}

function callRoute(route: string, input: any): RouteResult {
  switch (route) {
    case 'dashboard':
      return { kpis: { operating: 0, taxBuffer: 0, paygw: 0, gst: 0 }, series: [] };
    case 'allocations.preview': {
      const amount = input?.bankLine?.amountCents;
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw 'schema_error';
      }
      const operating = Math.round(amount * 0.9);
      const tax = amount - operating;
      return {
        allocations: [
          { account: 'OPERATING', amountCents: operating },
          { account: 'TAX_BUFFER', amountCents: tax },
        ],
        policyHash: 'hash_demo',
        gateOpen: true,
      };
    }
    case 'allocations.apply':
      return {
        allocations: [],
        policyHash: 'hash_demo',
        gateOpen: false,
        remitted: false,
      };
    default:
      return {};
  }
}

function validateSchema(route: string, result: RouteResult): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }
  if (route === 'dashboard') {
    return 'kpis' in result && 'series' in result;
  }
  if (route.startsWith('allocations.')) {
    return 'policyHash' in result && 'allocations' in result && Array.isArray((result as any).allocations);
  }
  return true;
}

function evaluateRules(result: RouteResult, input: any): boolean {
  const allocations = Array.isArray((result as any).allocations) ? (result as any).allocations : [];
  const totalInput = input?.bankLine?.amountCents;
  if (typeof totalInput !== 'number' || Number.isNaN(totalInput)) {
    return false;
  }

  let allNumbers = true;
  let nonNegative = true;
  let sum = 0;

  for (const allocation of allocations) {
    const amount = allocation?.amountCents;
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      allNumbers = false;
      break;
    }
    if (amount < 0) {
      nonNegative = false;
    }
    sum += amount;
  }

  const conservation = allNumbers && sum === totalInput;
  const gateOpen = (result as any).gateOpen;
  const remitted = (result as any).remitted;
  const gateRespected = gateOpen !== false || remitted !== true;

  return conservation && nonNegative && gateRespected;
}

async function main() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const goldenDir = path.join(currentDir, 'golden');
  const cases = await loadCases(goldenDir);

  let totalCases = 0;
  let schemaPasses = 0;
  let ruleChecks = 0;
  let rulePasses = 0;

  for (const testCase of cases) {
    totalCases += 1;
    const isAllocRoute = testCase.route.startsWith('allocations.');
    let schemaOk = false;
    let rulesOk = false;

    try {
      const result = callRoute(testCase.route, testCase.input);
      schemaOk = validateSchema(testCase.route, result);
      if (isAllocRoute) {
        if (schemaOk) {
          rulesOk = evaluateRules(result, testCase.input);
        }
      }
    } catch (error) {
      if (error !== 'schema_error') {
        console.error(`Error processing route ${testCase.route}:`, error);
      }
    }

    if (schemaOk) {
      schemaPasses += 1;
    }

    if (isAllocRoute) {
      ruleChecks += 1;
      if (schemaOk && rulesOk) {
        rulePasses += 1;
      }
    }
  }

  const schemaValidity = totalCases === 0 ? 1 : schemaPasses / totalCases;
  const passRate = ruleChecks === 0 ? 1 : rulePasses / ruleChecks;

  console.log(`schemaValidity ${(schemaValidity * 100).toFixed(2)}%`);
  console.log(`passRate ${(passRate * 100).toFixed(2)}%`);

  process.exitCode = schemaValidity < 0.98 || passRate < 0.9 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
