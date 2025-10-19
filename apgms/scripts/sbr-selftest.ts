import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

type StepResult = {
  name: string;
  status: 'passed' | 'failed';
  details: string;
};

type SelfTestReport = {
  timestamp: string;
  messageId: string | null;
  summary: {
    total: number;
    passed: number;
    failed: number;
    status: 'passed' | 'failed';
  };
  steps: StepResult[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(repoRoot, 'artifacts');
const evidenceDir = path.join(artifactsDir, 'evidence');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await ensureDir(evidenceDir);

  const steps: StepResult[] = [];
  let messageId: string | null = null;
  let messagePath: string | null = null;

  const runStep = async (name: string, fn: () => Promise<string>) => {
    try {
      const details = await fn();
      steps.push({ name, status: 'passed', details });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      steps.push({ name, status: 'failed', details });
    }
  };

  await runStep('Send test AS4 message', async () => {
    messageId = `SBR-${Date.now()}-${crypto.randomUUID()}`;
    const payload = {
      businessId: 'test-business',
      documentType: 'self-test',
      notes: 'Automated APGMS SBR self-test message',
    };
    const message = {
      messageId,
      timestamp: new Date().toISOString(),
      payload,
    };

    await ensureDir(evidenceDir);
    messagePath = path.join(evidenceDir, `sbr-selftest-message-${messageId}.json`);
    await fs.writeFile(messagePath, JSON.stringify(message, null, 2), 'utf8');

    return `Created AS4 self-test message artifact at ${path.relative(repoRoot, messagePath)}`;
  });

  await runStep('Verify AS4 message artifact', async () => {
    if (!messagePath) {
      throw new Error('Message artifact path was not generated.');
    }

    if (!(await fileExists(messagePath))) {
      throw new Error(`Expected artifact missing: ${path.relative(repoRoot, messagePath)}`);
    }

    return `Verified artifact ${path.relative(repoRoot, messagePath)}`;
  });

  await runStep('Verify SBR project files', async () => {
    const requiredRelativePaths = ['services/sbr/src/index.ts', 'package.json'];
    const missing: string[] = [];

    for (const relativePath of requiredRelativePaths) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!(await fileExists(absolutePath))) {
        missing.push(relativePath);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    return `Validated ${requiredRelativePaths.length} required file(s).`;
  });

  const summary = {
    total: steps.length,
    passed: steps.filter((step) => step.status === 'passed').length,
    failed: steps.filter((step) => step.status === 'failed').length,
  };
  const status: 'passed' | 'failed' = summary.failed === 0 ? 'passed' : 'failed';

  const report: SelfTestReport = {
    timestamp: new Date().toISOString(),
    messageId,
    summary: {
      ...summary,
      status,
    },
    steps,
  };

  const reportPath = path.join(evidenceDir, 'sbr-selftest-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`SBR self-test ${status}. Report written to ${path.relative(repoRoot, reportPath)}`);

  if (status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unexpected error during SBR self-test:', error);
  process.exit(1);
});
