import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type Check = { name: string; ok: boolean; note?: string };

function exists(p: string) {
  return fs.existsSync(path.resolve(process.cwd(), p));
}
function grepSync(pattern: RegExp, file: string): boolean {
  try {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) return false;
    const txt = fs.readFileSync(full, 'utf8');
    return pattern.test(txt);
  } catch {
    return false;
  }
}
function run(cmd: string, args: string[], opts: any = {}) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  return { code: res.status ?? 0, out: (res.stdout || '') + (res.stderr || '') };
}
function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const checks: Check[] = [];

// 1) Required files (Auth + Org-scope)
[
  'services/api-gateway/src/plugins/auth.ts',
  'services/api-gateway/src/hooks/org-scope.ts',
  'services/api-gateway/test/auth.spec.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 2) Schemas & Contract
[
  'packages/shared/src/schemas/report.ts',
  'services/api-gateway/src/plugins/openapi.ts',
  'services/api-gateway/test/contract.spec.ts',
  'scripts/emit-openapi.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 3) Routes & Idempotency
[
  'services/api-gateway/src/routes/v1/reports.ts',
  'services/api-gateway/src/plugins/redis.ts',
  'services/api-gateway/src/utils/idempotency.ts',
  'services/api-gateway/test/idempotency.spec.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 4) HTTP Surface Security
[
  'services/api-gateway/src/plugins/cors-allowlist.ts',
  'services/api-gateway/src/plugins/request-id.ts',
  'services/api-gateway/src/plugins/audit.ts',
  'services/api-gateway/test/http-security.spec.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 5) Config & Secrets
[
  '.env.example',
  'services/api-gateway/src/config.ts',
  'scripts/key-rotate.ts',
  'services/api-gateway/test/config.spec.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 6) Observability
[
  'services/api-gateway/src/plugins/metrics.ts',
  'services/api-gateway/src/plugins/health.ts',
  'services/api-gateway/src/plugins/tracing.ts',
  'services/api-gateway/test/observability.spec.ts',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 7) Tests & CI
[
  'vitest.config.ts',
  'services/api-gateway/test/reports.e2e.spec.ts',
  '.github/workflows/ci.yml',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 8) Resilience & Performance
[
  'k6/smoke.js',
  'k6/load.js',
  'docs/slo.md',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 10) Build & Release
[
  'services/api-gateway/Dockerfile',
  'services/api-gateway/.dockerignore',
  '.github/workflows/release.yml',
].forEach(p => checks.push({ name: `exists:${p}`, ok: exists(p) }));

// 9) (Optional here) prisma migrations presence indicator if your repo uses prisma
// checks.push({ name: 'exists:prisma', ok: exists('prisma/migrations') });

// Greps/wiring sanity checks (non-fatal but useful)
checks.push({ name: 'index imports auth', ok: grepSync(/plugins\/auth/, 'services/api-gateway/src/index.ts') });
checks.push({ name: 'index imports openapi', ok: grepSync(/plugins\/openapi/, 'services/api-gateway/src/index.ts') });
checks.push({ name: 'index registers redis', ok: grepSync(/plugins\/redis/, 'services/api-gateway/src/index.ts') || grepSync(/register\(redisPlugin\)/, 'services/api-gateway/src/index.ts') });
checks.push({ name: 'index registers metrics', ok: grepSync(/plugins\/metrics/, 'services/api-gateway/src/index.ts') });
checks.push({ name: 'index registers health', ok: grepSync(/plugins\/health/, 'services/api-gateway/src/index.ts') });
checks.push({ name: 'index registers tracing', ok: grepSync(/plugins\/tracing/, 'services/api-gateway/src/index.ts') });

// Print file checks
section('FILE & WIRING CHECKS');
const failures = checks.filter(c => !c.ok);
checks.forEach(c => console.log(`${c.ok ? '✅' : '❌'} ${c.name}`));

// Build all packages
section('BUILD');
const build = run('pnpm', ['-r', 'build']);
console.log(build.out.trim());
const buildOK = build.code === 0;

// Emit OpenAPI spec
section('OPENAPI EMIT');
const emit = run('pnpm', ['emit:openapi']);
console.log(emit.out.trim());
const emitOK = emit.code === 0 && exists('openapi.json');

// Tests with coverage
section('TESTS');
const tests = run('pnpm', ['-r', 'test', '--', '--coverage']);
console.log(tests.out.trim());
const testsOK = tests.code === 0;

// Summary
section('SUMMARY');
const allOK = failures.length === 0 && buildOK && emitOK && testsOK;
console.log(
  JSON.stringify(
    {
      files_ok: failures.length === 0,
      missing: failures.map(f => f.name),
      build_ok: buildOK,
      openapi_emit_ok: emitOK,
      tests_ok: testsOK,
      overall_pass: allOK,
    },
    null,
    2,
  ),
);

process.exit(allOK ? 0 : 1);
