# Release Readiness Review (integration/mega-merge)

## Executive Summary
APGMS is a pnpm workspace that nominally stitches together a Fastify API gateway, a collection of placeholder backend services, a stub worker, and a single-page webapp. In practice only the gateway and shared Prisma layer contain executable code; the remaining services expose `console.log` entry points with no build tooling or manifests, while the infrastructure, observability, and testing directories are empty shells. Security posture is especially weak: the lone write endpoint accepts unauthenticated JSON, persists it directly into Postgres, and logs the database URL on boot.

The repository advertises dev workflows (Playwright, k6, Terraform, Grafana) but all are placeholders. CI performs install/build/test cycles that inevitably run no meaningful work, there are no automated checks for privacy, security, or accessibility, and runbooks/documentation provide only headings. Shipping from the current branch would expose critical security gaps while offering no test or operational safety net.

## Compliance Table
| Standard | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| A | pnpm workspace installs cleanly; each package builds without echo stubs | **FAIL** | `shared/package.json` and `webapp/package.json` use `echo` build scripts; most `services/*` lack manifests |
| A | TypeScript strict mode on for services and webapp | **FAIL** | Only `services/api-gateway/tsconfig.json` enables `strict`; other TS workspaces have no config |
| A | Lockfile committed | **PASS** | `pnpm-lock.yaml` present at repo root |
| A (S) | One "dev up" path (docker compose or scripts) | **FAIL** | `docker-compose.yml` starts only Postgres/Redis; no app services |
| B | Auth on every HTTP route | **FAIL** | `services/api-gateway/src/index.ts` exposes routes with no auth |
| B | CORS allowlisted | **FAIL** | `origin: true` in CORS registration |
| B | Security headers enabled | **FAIL** | No helmet/CSP registration |
| B | Never log secrets | **FAIL** | Logs `DATABASE_URL` on startup |
| B | Write endpoints idempotent | **FAIL** | `POST /bank-lines` lacks idempotency key |
| B (S) | Rate limiting/input limits/timeouts | **FAIL** | No limiter or timeout configuration |
| C | Zod validation on request/response | **FAIL** | `POST /bank-lines` casts `req.body` directly |
| C (S) | OpenAPI emitted | **FAIL** | No generator or schema exports |
| D | Passwords hashed | **FAIL** | Seed script inserts plaintext password |
| D | Log redaction/masking | **FAIL** | No masking utilities |
| D | Subject export/delete endpoints documented | **FAIL** | Not documented anywhere |
| D (S) | Data retention policy documented/enforced | **FAIL** | Not documented |
| E | Structured logs with request IDs; `/health` & `/ready` | **FAIL** | Fastify default logger only; no readiness route |
| E | Metrics/tracing | **FAIL** | No metrics or OTEL instrumentation |
| E (S) | Error ratios/latency SLOs | **FAIL** | Not defined |
| F | Pagination / max page size | **PASS** | `/bank-lines` caps `take` at 200 |
| F | Timeouts / safe retries | **FAIL** | No timeout or retry logic |
| F (S) | Circuit breakers/backoff | **FAIL** | Not implemented |
| G | Axe checks in CI | **FAIL** | No CI step for accessibility |
| G (S) | A11y spec (roles, focus, contrast) | **FAIL** | Docs placeholder only |
| H | CI install→build→tests→e2e→security gates | **FAIL** | CI build/test run echo scripts; security workflow is `echo scanning`; no e2e |
| H | Security gates (secret scan, SCA/SBOM, CodeQL) | **FAIL** | Not configured |
| H | Protected branch requires jobs | **FAIL** | Not documented/enforced |
| H (S) | pnpm caching, artifacts, deps bots | **FAIL** | No caching beyond setup-node, no dependabot/renovate |
| I | README with dev up, env vars, smoke cmds | **FAIL** | README is a command list without context or env details |
| I | Runbooks for smoke/rollback/incidents | **FAIL** | Docs/runbooks are single-line headings |
| I (S) | Security.md & Privacy.md reference controls | **FAIL** | Only placeholders |

## Gaps & Fixes
### P0 — Unauthenticated, unvalidated write endpoint
- **Impact:** Anyone can POST arbitrary payloads to `/bank-lines`, leading to data corruption and injection risk.
- **Evidence:** `services/api-gateway/src/index.ts` lacks auth, accepts `req.body` directly, and persists to Prisma.
- **Minimal Fix:**
```diff
+import crypto from "node:crypto";
+import helmet from "@fastify/helmet";
+import { z } from "zod";
+
 const app = Fastify({ logger: true });
-
-await app.register(cors, { origin: true });
-
-// sanity log: confirm env is loaded
-app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");
+await app.register(cors, {
+  origin: (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
+});
+await app.register(helmet);
+
+app.addHook("onRequest", async (req, rep) => {
+  const key = req.headers["x-api-key"];
+  if (req.method !== "GET" && key !== process.env.API_GATEWAY_KEY) {
+    return rep.code(401).send({ error: "unauthorized" });
+  }
+  (req as any).reqId ??= crypto.randomUUID();
+});
+
+const CreateBankLine = z.object({
+  orgId: z.string().min(1),
+  date: z.coerce.date(),
+  amount: z.coerce.number(),
+  payee: z.string().min(1),
+  desc: z.string().min(1),
+});
+const BankLineResponse = CreateBankLine.extend({ id: z.string(), createdAt: z.date() });
+
+const IDEMPOTENCY_TTL_SEC = Number(process.env.IDEMPOTENCY_TTL_SEC ?? 3600);
+const idempotencyCache = new Map<string, { expiresAt: number; payload: unknown }>();
+
+app.addHook("preHandler", async (req, rep) => {
+  if (req.method === "POST") {
+    const key = req.headers["idempotency-key"];
+    if (!key || typeof key !== "string") {
+      return rep.code(400).send({ error: "missing_idempotency_key" });
+    }
+    const cached = idempotencyCache.get(key);
+    if (cached && cached.expiresAt > Date.now()) {
+      return rep.send(cached.payload);
+    }
+    idempotencyCache.set(key, { expiresAt: Date.now() + IDEMPOTENCY_TTL_SEC * 1000, payload: null });
+  }
+});
...
-  try {
-    const body = req.body as {
-      orgId: string;
-      date: string;
-      amount: number | string;
-      payee: string;
-      desc: string;
-    };
-    const created = await prisma.bankLine.create({
-      data: {
-        orgId: body.orgId,
-        date: new Date(body.date),
-        amount: body.amount as any,
-        payee: body.payee,
-        desc: body.desc,
-      },
-    });
-    return rep.code(201).send(created);
-  } catch (e) {
-    req.log.error(e);
-    return rep.code(400).send({ error: "bad_request" });
-  }
+  const body = CreateBankLine.parse(req.body);
+  const created = await prisma.bankLine.create({
+    data: body,
+  });
+  const payload = BankLineResponse.parse(created);
+  const key = req.headers["idempotency-key"] as string;
+  if (key) {
+    idempotencyCache.set(key, { expiresAt: Date.now() + IDEMPOTENCY_TTL_SEC * 1000, payload });
+  }
+  return rep.code(201).send(payload);
 });
```
- **Env Vars:**
  - `API_GATEWAY_KEY` (required)
  - `ALLOWED_ORIGINS="https://app.example.com"`
  - `IDEMPOTENCY_TTL_SEC=3600`

### P0 — Secrets logged to stdout
- **Impact:** `DATABASE_URL` is emitted to the application log, risking credential disclosure in any log sink.
- **Evidence:** Startup log dumps `process.env.DATABASE_URL`.
- **Minimal Fix:** Remove the structured secret log.
```diff
-app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");
+app.log.info("environment loaded");
```

### P0 — Plaintext credentials in seed script
- **Impact:** Seeding inserts `password123` directly, violating privacy requirements and risking accidental credential reuse.
- **Evidence:** `scripts/seed.ts` creates a user with a plaintext `password` field.
- **Minimal Fix:** Hash the seed password before storage.
```diff
-import { PrismaClient } from "@prisma/client";
+import { PrismaClient } from "@prisma/client";
+import bcrypt from "bcryptjs";
...
-    create: { email: "founder@example.com", password: "password123", orgId: org.id },
+    create: {
+      email: "founder@example.com",
+      password: await bcrypt.hash(process.env.SEED_USER_PASSWORD ?? "ChangeMe123!", 12),
+      orgId: org.id,
+    },
```
- **Env Vars:**
  - `SEED_USER_PASSWORD="ChangeMe123!"`

### P1 — Workspace packages lack builds/tests
- **Impact:** CI green builds provide false confidence; key packages are missing manifests or use `echo` scripts.
- **Evidence:** `services/audit`, `services/cdr`, etc. have no `package.json`; `shared`, `webapp`, and `worker` use `echo` scripts.
- **Minimal Fix:** Add minimal `package.json` with real `tsc --noEmit` builds/tests or remove unused workspaces.
```diff
+{
+  "name": "@apgms/audit",
+  "version": "0.1.0",
+  "private": true,
+  "scripts": {
+    "build": "tsc --noEmit",
+    "test": "vitest"
+  },
+  "devDependencies": {
+    "typescript": "^5.9.3",
+    "vitest": "^2.1.1"
+  }
+}
```

### P1 — CI security gates are stubs
- **Impact:** Vulnerabilities or leaked secrets reach production unnoticed because workflows only run `echo` commands.
- **Evidence:** `.github/workflows/security.yml` contains `echo scanning`.
- **Minimal Fix:** Replace with real scanners (e.g., Gitleaks + npm audit + CodeQL) that fail on findings.
```diff
   scan:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
-      - run: echo scanning
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '18'
+      - name: Install pnpm
+        uses: pnpm/action-setup@v4
+        with:
+          version: 9
+      - run: pnpm install --frozen-lockfile
+      - name: Secret scanning
+        uses: zricethezav/gitleaks-action@v2
+      - name: Dependency audit
+        run: pnpm audit --recursive --prod
+      - name: Upload SBOM
+        run: pnpm exec cyclonedx-bom --output sbom.json
+      - uses: actions/upload-artifact@v4
+        with:
+          name: sbom
+          path: sbom.json
```

### P2 — Observability gaps
- **Impact:** Operators lack readiness checks, metrics, or structured request IDs for debugging incidents.
- **Evidence:** API exposes only `/health` and uses default Fastify logger.
- **Minimal Fix:** Add `/ready` that pings dependencies, attach request IDs, and emit Prometheus counters.
```diff
+import fastifyMetrics from "@fastify/metrics";
...
+await app.register(fastifyMetrics);
+
+app.get("/ready", async (_req, rep) => {
+  await prisma.$queryRaw`SELECT 1`;
+  return rep.send({ ready: true });
+});
```

## PR Plan
1. **"API gateway edge hardening"** — Scope: `services/api-gateway/src/index.ts`, `.env.example`. Adds auth pre-handler, CORS allowlist, helmet, Zod validation, idempotency cache, readiness endpoint. *Risk:* medium; rollback by redeploying previous container. *Smoke:* `pnpm --filter @apgms/api-gateway dev` then `curl -H 'x-api-key:...' http://localhost:3000/ready`.
2. **"Secure seed data"** — Scope: `scripts/seed.ts`, `package.json`. Adds bcrypt dependency, hashes default password, documents `SEED_USER_PASSWORD`. *Risk:* low; rollback by reverting script. *Smoke:* `pnpm exec tsx scripts/seed.ts`.
3. **"Workspace build hygiene"** — Scope: `services/*/package.json`, `webapp/package.json`, `worker/package.json`. Replace echo scripts with `tsc`/`vitest`, add missing manifests. *Risk:* medium (may surface TS errors); rollback by reverting per-package files. *Smoke:* `pnpm -r run build`.
4. **"Security gates workflow"** — Scope: `.github/workflows/security.yml`. Introduce gitleaks, pnpm audit, CycloneDX SBOM upload. *Risk:* low; rollback by disabling workflow. *Smoke:* `act -j scan` locally or re-run workflow.
5. **"Observability essentials"** — Scope: `services/api-gateway/src/index.ts`, `shared/src/db.ts`. Adds request IDs, `/ready`, Prometheus metrics. *Risk:* low/medium; rollback by redeploying previous build. *Smoke:* `curl http://localhost:3000/metrics`.

## Release Checklist
| Check | Status | Command |
| --- | --- | --- |
| Install & Build | **FAIL** | `pnpm i && pnpm -r run build` |
| Unit / Integration Tests | **FAIL** | `pnpm -r run test` |
| Playwright E2E | **FAIL** | `pnpm -w exec playwright test` |
| Docker Compose | **FAIL** | `docker compose up -d && curl http://localhost:3000/health` |
| Smoke (health/ready) | **FAIL** | `curl http://localhost:3000/ready` |
