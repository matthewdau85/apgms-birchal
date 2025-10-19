import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

type Report = {
  expectedToFound: Record<string, string[]>;
  unexpectedMatches: string[];
  missing: string[];
};

const repoRoot = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.next',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'coverage',
  '.vite',
  '.pnpm-store',
  '.yarn',
  '.idea',
  '.DS_Store',
]);

// Expected files by category (adjusted for your workspaces)
const EXPECTED: string[] = [
  // 1) AuthN & Org-scoped AuthZ
  'services/api-gateway/src/plugins/auth.ts',
  'services/api-gateway/src/hooks/org-scope.ts',
  'services/api-gateway/test/auth.spec.ts',

  // 2) Schemas & Contract
  'shared/src/schemas/report.ts',
  'services/api-gateway/src/plugins/openapi.ts',
  'services/api-gateway/test/contract.spec.ts',
  'scripts/emit-openapi.ts',
  'openapi.json', // artifact (should exist after emit)

  // 3) Routes & Idempotency
  'services/api-gateway/src/routes/v1/reports.ts',
  'services/api-gateway/src/plugins/redis.ts',
  'services/api-gateway/src/utils/idempotency.ts',
  'services/api-gateway/test/idempotency.spec.ts',

  // 4) HTTP Surface Security
  'services/api-gateway/src/plugins/cors-allowlist.ts',
  'services/api-gateway/src/plugins/request-id.ts',
  'services/api-gateway/src/plugins/audit.ts',
  'services/api-gateway/test/http-security.spec.ts',

  // 5) Config & Secrets Hygiene
  '.env.example',
  'services/api-gateway/src/config.ts',
  'scripts/key-rotate.ts',
  'services/api-gateway/test/config.spec.ts',

  // 6) Observability
  'services/api-gateway/src/plugins/metrics.ts',
  'services/api-gateway/src/plugins/health.ts',
  'services/api-gateway/src/plugins/tracing.ts',
  'services/api-gateway/test/observability.spec.ts',

  // 7) Automated Testing & CI
  'vitest.config.ts',
  'services/api-gateway/test/reports.e2e.spec.ts',
  '.github/workflows/ci.yml',

  // 8) Resilience & Performance
  'k6/smoke.js',
  'k6/load.js',
  'docs/slo.md',

  // 10) Build & Release
  'services/api-gateway/Dockerfile',
  'services/api-gateway/.dockerignore',
  '.github/workflows/release.yml',
];

// Map of basename → expected paths (for locating misplaced files by filename)
const EXPECTED_BY_BASENAME = EXPECTED.reduce<Record<string, string[]>>((acc, rel) => {
  const base = path.basename(rel);
  (acc[base] ||= []).push(rel);
  return acc;
}, {});

// Basic recursive walk with ignores
async function walk(dir: string, found: string[]) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.git') || IGNORE_DIRS.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(abs, found);
    } else if (e.isFile()) {
      found.push(abs);
    }
  }
}

function toRel(abs: string): string {
  return path.relative(repoRoot, abs).split(path.sep).join('/');
}

(async () => {
  const t0 = performance.now();

  const allFilesAbs: string[] = [];
  await walk(repoRoot, allFilesAbs);

  const allFilesRel = allFilesAbs.map(toRel);
  const expectedSet = new Set(EXPECTED);

  const expectedToFound: Record<string, string[]> = {};
  const unexpectedMatches: string[] = [];
  const missing: string[] = [];

  // Look for exact matches first
  for (const exp of EXPECTED) {
    const matches = allFilesRel.filter(p => p === exp);
    if (matches.length > 0) {
      expectedToFound[exp] = matches;
    }
  }

  // For those still missing, find by basename anywhere in repo
  for (const exp of EXPECTED) {
    if (expectedToFound[exp]) continue;
    const base = path.basename(exp);
    const candidates = allFilesRel.filter(p => path.basename(p) === base);
    if (candidates.length > 0) {
      expectedToFound[exp] = candidates;
    }
  }

  // Missing = no matches at all
  for (const exp of EXPECTED) {
    if (!expectedToFound[exp] || expectedToFound[exp].length === 0) {
      missing.push(exp);
    }
  }

  // Unexpected: files that have a basename equal to any expected file, but whose full path isn't one of the expected paths
  const expectedBasenames = new Set(Object.keys(EXPECTED_BY_BASENAME));
  for (const p of allFilesRel) {
    const base = path.basename(p);
    if (expectedBasenames.has(base) && !expectedSet.has(p)) {
      // Ensure we only add if it wasn't already recorded as an acceptable alternative (we still consider it unexpected placement)
      unexpectedMatches.push(p);
    }
  }

  const report: Report = {
    expectedToFound,
    unexpectedMatches: Array.from(new Set(unexpectedMatches)).sort(),
    missing: Array.from(new Set(missing)).sort(),
  };

  console.log(JSON.stringify(report, null, 2));

  const t1 = performance.now();
  console.error(`[scan-required] scanned ${allFilesRel.length} files in ${(t1 - t0).toFixed(0)}ms`);
})().catch((e) => {
  console.error('scan error:', e);
  process.exit(1);
});

