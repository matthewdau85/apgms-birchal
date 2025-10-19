import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

const CASES_DIR = path.resolve(__dirname, 'redteam');
const REPORT_PATH = path.resolve(__dirname, 'redteam-report.json');

const caseSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  prompt: z.string(),
  context: z.string().optional(),
  attackGoal: z.string(),
  expectedModelBehavior: z.string(),
  severity: z.enum(['critical', 'non-critical']),
  reviewedBy: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type RedTeamCase = z.infer<typeof caseSchema>;

type Classification = 'critical' | 'non-critical';

interface CaseResult {
  file: string;
  id: string;
  name: string;
  category: string;
  severity: Classification;
  classification: Classification;
  reason: string;
}

async function loadCases(): Promise<{ cases: RedTeamCase[]; files: string[] }> {
  const entries = await fs.readdir(CASES_DIR);
  const jsonFiles = entries.filter((file) => file.endsWith('.json') && file !== '_schema.json');

  const cases: RedTeamCase[] = [];
  const files: string[] = [];

  for (const file of jsonFiles.sort()) {
    const absolutePath = path.join(CASES_DIR, file);
    const raw = await fs.readFile(absolutePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = caseSchema.safeParse(parsed);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `  - ${issue.path.join('.')} ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid red-team case in ${file}:\n${message}`);
    }

    cases.push(result.data);
    files.push(file);
  }

  if (cases.length === 0) {
    throw new Error(`No red-team cases found in ${CASES_DIR}`);
  }

  return { cases, files };
}

function classifyCase(redTeamCase: RedTeamCase, sourceFile: string): CaseResult {
  const classification: Classification = redTeamCase.severity;
  const reason =
    classification === 'critical'
      ? 'Case is marked as critical in the curated dataset and requires mitigation before release.'
      : 'Case is marked as non-critical and does not block release but should be monitored.';

  return {
    file: sourceFile,
    id: redTeamCase.id,
    name: redTeamCase.name,
    category: redTeamCase.category,
    severity: redTeamCase.severity,
    classification,
    reason,
  };
}

async function writeReport(results: CaseResult[]) {
  const totals = results.reduce(
    (acc, item) => {
      acc.cases += 1;
      acc[item.classification] += 1;
      return acc;
    },
    { cases: 0, critical: 0, 'non-critical': 0 } as Record<'cases' | 'critical' | 'non-critical', number>,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    results,
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  return totals;
}

async function main() {
  try {
    const { cases, files } = await loadCases();
    const results = cases.map((item, index) => classifyCase(item, files[index]));

    const totals = await writeReport(results);

    console.log(`Red-team evaluation completed. Cases: ${totals.cases}. Critical: ${totals.critical}. Non-critical: ${totals['non-critical']}.`);
    console.log(`Report written to ${path.relative(process.cwd(), REPORT_PATH)}`);

    if (totals.critical > 0) {
      console.error('Critical red-team findings detected. Failing evaluation.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to run red-team evaluation:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
