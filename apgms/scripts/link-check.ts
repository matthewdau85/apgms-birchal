import { promises as fs } from 'fs';
import path from 'path';

interface CheckResult {
  readonly file: string;
  readonly ok: boolean;
  readonly message: string;
}

const repoRoot = path.resolve(__dirname, '..');
const pages = [
  'webapp/src/routes/legal/terms.tsx',
  'webapp/src/routes/legal/privacy.tsx',
  'webapp/src/routes/legal/dpa.tsx',
];

const requiredLinks = ['/privacy/export', '/privacy/delete'];
const requiredPhrases = ['Data Handling'];

async function verifyFile(relativePath: string): Promise<CheckResult> {
  const fullPath = path.join(repoRoot, relativePath);

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    for (const link of requiredLinks) {
      if (!content.includes(link)) {
        return {
          file: relativePath,
          ok: false,
          message: `Missing required link: ${link}`,
        };
      }
    }

    for (const phrase of requiredPhrases) {
      if (!content.toLowerCase().includes(phrase.toLowerCase())) {
        return {
          file: relativePath,
          ok: false,
          message: `Missing required phrase: ${phrase}`,
        };
      }
    }

    return {
      file: relativePath,
      ok: true,
      message: 'All checks passed',
    };
  } catch (error) {
    return {
      file: relativePath,
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main(): Promise<void> {
  const results = await Promise.all(pages.map((page) => verifyFile(page)));
  const failures = results.filter((result) => !result.ok);

  for (const result of results) {
    const status = result.ok ? '✅' : '❌';
    console.log(`${status} ${result.file} — ${result.message}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
