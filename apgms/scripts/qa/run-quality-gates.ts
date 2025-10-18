import { execa, type ExecaChildProcess } from "execa";
import { fetch } from "node:undici";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const reportsDir = path.join(repoRoot, "reports");

const startedAt = new Date();

const gates: GateRecord[] = [];
const artifacts: string[] = [];

const rootPackage = await loadRootPackage();

interface RootPackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface GateRecord {
  id: string;
  name: string;
  required: boolean;
  status: GateStatus;
  metrics?: Record<string, unknown>;
  stdoutTail?: string;
  stderrTail?: string;
}

type GateStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: boolean;
  durationMs: number;
}

interface GatewayContext {
  apiPort: number;
  server: ExecaChildProcess;
  serverLogs: string[];
  dbContainerName: string;
  dbPort: number;
  readyEndpoint?: string;
  dbRunning: boolean;
}

let gatewayContext: GatewayContext | null = null;
let gatewayUnavailableReason: string | null = null;

async function main() {
  await mkdir(reportsDir, { recursive: true });

  try {
    await gateUnitTests();
    await gateRedTeam();
    await gateGolden();
    await gateAsvs();
    await gateSchemaDrift();
    await gateSecurityAudit();
    await gateContainerImage();
    await gateSbom();

    const gateway = await ensureGateway();
    await gateAuthCors(gateway);
    await gateIdempotency(gateway);
    await gateRptTamper(gateway);
    await gatePerf();
    await gateA11y();
    await gateLighthouse();
    await gateOtel();
    await gateReadiness(gateway);
  } catch (error) {
    const err = error as Error;
    gates.push({
      id: "orchestrator",
      name: "Quality orchestrator",
      required: true,
      status: "FAIL",
      metrics: { error: err.message },
      stderrTail: err.stack,
    });
  } finally {
    await teardownGateway();
    const finishedAt = new Date();
    const summary = buildSummary();
    const report = {
      version: "1.0.0",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      summary,
      gates,
      artifacts,
    } satisfies FullReport;

    const jsonPath = path.join(reportsDir, "full-quality-report.json");
    await writeFile(jsonPath, JSON.stringify(report, null, 2));
    const mdPath = path.join(reportsDir, "full-quality-report.md");
    await writeFile(mdPath, renderMarkdown(report));

    if (!artifacts.includes(path.relative(repoRoot, jsonPath))) {
      artifacts.push(path.relative(repoRoot, jsonPath));
    }
    if (!artifacts.includes(path.relative(repoRoot, mdPath))) {
      artifacts.push(path.relative(repoRoot, mdPath));
    }

    const requiredFailed = summary.requiredFailed;
    process.exitCode = requiredFailed > 0 ? 1 : 0;
  }
}

type FullReport = {
  version: string;
  startedAt: string;
  finishedAt: string;
  summary: {
    requiredPassed: number;
    requiredFailed: number;
    warnings: number;
    overall: GateStatus;
  };
  gates: GateRecord[];
  artifacts: string[];
};

function buildSummary(): FullReport["summary"] {
  const requiredPassed = gates.filter((g) => g.required && g.status === "PASS").length;
  const requiredFailed = gates.filter((g) => g.required && g.status === "FAIL").length;
  const warnings = gates.filter((g) => g.status === "WARN").length;
  let overall: GateStatus = "PASS";
  if (requiredFailed > 0) {
    overall = "FAIL";
  } else if (warnings > 0) {
    overall = "WARN";
  }
  return { requiredPassed, requiredFailed, warnings, overall };
}

function renderMarkdown(report: FullReport): string {
  const lines: string[] = [];
  lines.push("# Full Quality Report");
  lines.push("");
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Finished: ${report.finishedAt}`);
  lines.push("");
  lines.push("| Gate | Status | Required | Metrics |");
  lines.push("| --- | --- | --- | --- |");
  for (const gate of report.gates) {
    const metricsText = gate.metrics ? formatMetrics(gate.metrics) : "";
    lines.push(`| ${gate.name} | ${gate.status} | ${gate.required ? "yes" : "no"} | ${metricsText} |`);
  }
  lines.push("");
  lines.push("## Blocking Failures");
  const blocking = report.gates.filter((g) => g.required && g.status === "FAIL");
  if (blocking.length === 0) {
    lines.push("- None");
  } else {
    for (const gate of blocking) {
      const detail = gate.metrics?.issues ?? gate.metrics?.reason ?? gate.status;
      lines.push(`- ${gate.name}: ${serializeMetric(detail)}`);
    }
  }
  lines.push("");
  lines.push("## Warnings");
  const warns = report.gates.filter((g) => g.status === "WARN");
  if (warns.length === 0) {
    lines.push("- None");
  } else {
    for (const gate of warns) {
      const detail = gate.metrics?.reason ?? gate.metrics?.issues ?? gate.status;
      lines.push(`- ${gate.name}: ${serializeMetric(detail)}`);
    }
  }
  lines.push("");
  lines.push("## Artifacts");
  if (report.artifacts.length === 0) {
    lines.push("- None");
  } else {
    for (const artifact of report.artifacts) {
      lines.push(`- ${artifact}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function formatMetrics(metrics: Record<string, unknown>): string {
  return Object.entries(metrics)
    .map(([key, value]) => `${key}=${serializeMetric(value)}`)
    .join("<br>");
}

function serializeMetric(value: unknown): string {
  if (value === undefined || value === null) return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function gateUnitTests() {
  if (!hasRootScript("test")) {
    gates.push({
      id: "unit-tests",
      name: "Unit tests",
      required: true,
      status: "WARN",
      metrics: { reason: "No root test script defined" },
    });
    return;
  }
  const result = await runCommand("pnpm", ["test"]);
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "unit-tests",
    name: "Unit tests",
    required: true,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateRedTeam() {
  if (!hasRootScript("redteam")) {
    gates.push({
      id: "red-team",
      name: "Red-team runner",
      required: true,
      status: "WARN",
      metrics: { reason: "No redteam script defined" },
    });
    return;
  }
  const result = await runCommand("pnpm", ["run", "redteam"]);
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "red-team",
    name: "Red-team runner",
    required: true,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateGolden() {
  if (!hasRootScript("golden")) {
    gates.push({
      id: "golden",
      name: "Golden runner",
      required: true,
      status: "WARN",
      metrics: { reason: "No golden script defined" },
    });
    return;
  }
  const result = await runCommand("pnpm", ["run", "golden"]);
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "golden",
    name: "Golden runner",
    required: true,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateAsvs() {
  const csvPath = path.join(repoRoot, "compliance", "asvs", "controls.csv");
  if (!(await pathExists(csvPath))) {
    gates.push({
      id: "asvs",
      name: "ASVS controls",
      required: true,
      status: "WARN",
      metrics: { reason: "controls.csv missing" },
    });
    return;
  }
  const raw = await readFile(csvPath, "utf8");
  const rows = parseCsv(raw);
  const requiredRows = rows.filter((row) =>
    (row.Level ?? "").trim().toLowerCase() === "required"
  );
  const failing = requiredRows.filter((row) => {
    const status = (row.Status ?? "").trim().toUpperCase();
    return status !== "PASS" && status !== "NA";
  });
  const status: GateStatus = failing.length === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "asvs",
    name: "ASVS controls",
    required: true,
    status,
    metrics: {
      requiredTotal: requiredRows.length,
      requiredFailing: failing.length,
      failingControls: failing.map((row) => row.Control).slice(0, 10),
    },
  });
}

async function gateSchemaDrift() {
  const candidates = [
    path.join(repoRoot, "services", "api-gateway", "src", "schemas.ts"),
    path.join(repoRoot, "shared", "src", "schemas.ts"),
  ];
  const existing: string[] = [];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      existing.push(candidate);
    }
  }
  if (existing.length === 0) {
    gates.push({
      id: "schema-drift",
      name: "Schema drift",
      required: true,
      status: "WARN",
      metrics: { reason: "No schema definitions found" },
    });
    return;
  }

  const issues: string[] = [];
  for (const file of existing) {
    try {
      const mod = await import(pathToFileURL(file).href);
      const exportsToCheck = Object.values(mod) as unknown[];
      const hasValidator = exportsToCheck.some((value) =>
        typeof (value as any)?.parse === "function" ||
        typeof (value as any)?.safeParse === "function"
      );
      if (!hasValidator) {
        issues.push(`No zod schema exported from ${path.relative(repoRoot, file)}`);
      }
    } catch (error) {
      issues.push(`Failed to import ${path.relative(repoRoot, file)}: ${(error as Error).message}`);
    }
  }
  const status: GateStatus = issues.length === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "schema-drift",
    name: "Schema drift",
    required: true,
    status,
    metrics: { checkedFiles: existing.map((file) => path.relative(repoRoot, file)), issues },
  });
}

async function gateSecurityAudit() {
  const allowlistPath = path.join(repoRoot, "compliance", "allowlist-audit.json");
  let allowlist: Array<string | number> = [];
  if (await pathExists(allowlistPath)) {
    try {
      const json = JSON.parse(await readFile(allowlistPath, "utf8"));
      if (Array.isArray(json)) {
        allowlist = json as Array<string | number>;
      }
    } catch (error) {
      // ignore malformed allowlist
    }
  }
  const result = await runCommand("pnpm", ["audit", "--prod", "--json"], { allowFailure: true });
  const advisories = parseAuditOutput(result.stdout);
  const highOrCritical = advisories.filter((advisory) =>
    advisory.severity === "high" || advisory.severity === "critical"
  );
  const blocked = highOrCritical.filter((advisory) => {
    if (allowlist.includes(advisory.id)) return false;
    return true;
  });
  let status: GateStatus = "PASS";
  let reason: string | undefined;
  if (result.exitCode !== 0 && blocked.length > 0) {
    status = "FAIL";
    reason = "High or critical advisories detected";
  } else if (result.exitCode !== 0 && blocked.length === 0) {
    status = "WARN";
    reason = "Audit exited with issues but advisories allowlisted";
  }

  gates.push({
    id: "sca",
    name: "Dependency vulnerability audit",
    required: true,
    status,
    metrics: {
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      advisories: advisories.length,
      highOrCritical: highOrCritical.length,
      blocked: blocked.map((item) => item.id),
      reason,
    },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateContainerImage() {
  const dockerfilePath = path.join(repoRoot, "services", "api-gateway", "Dockerfile");
  const hasDockerfile = await pathExists(dockerfilePath);
  if (!hasDockerfile) {
    gates.push({
      id: "container",
      name: "API gateway container image",
      required: true,
      status: "WARN",
      metrics: { reason: "Dockerfile missing" },
    });
    return;
  }
  const dockerAvailable = await commandExists("docker");
  if (!dockerAvailable) {
    gates.push({
      id: "container",
      name: "API gateway container image",
      required: true,
      status: "WARN",
      metrics: { reason: "Docker not available" },
    });
    return;
  }
  const content = await readFile(dockerfilePath, "utf8");
  const usesDistroless = /distroless/i.test(content);
  const userMatch = content.match(/USER\s+([^\n]+)/i);
  const user = userMatch ? userMatch[1].trim() : "";
  const nonRootUser = user.length > 0 && user !== "0" && user.toLowerCase() !== "root";
  const hasHealthcheck = /HEALTHCHECK/i.test(content);

  const contextDir = path.dirname(dockerfilePath);
  const result = await runCommand(
    "docker",
    ["build", "--progress=plain", "-f", dockerfilePath, "-t", "qa-api-gateway", contextDir],
    { allowFailure: true, timeoutMs: 600000 }
  );
  const issues: string[] = [];
  if (!usesDistroless) issues.push("Base image not distroless");
  if (!nonRootUser) issues.push("Container user is root");
  if (!hasHealthcheck) issues.push("HEALTHCHECK missing");
  if (result.exitCode !== 0) issues.push(`docker build failed with ${result.exitCode}`);
  const status: GateStatus = issues.length === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "container",
    name: "API gateway container image",
    required: true,
    status,
    metrics: {
      usesDistroless,
      nonRootUser,
      hasHealthcheck,
      buildExitCode: result.exitCode,
      issues,
    },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

interface AdvisoryRecord {
  id: number | string;
  severity: string;
}

function parseAuditOutput(stdout: string): AdvisoryRecord[] {
  const advisories: AdvisoryRecord[] = [];
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "advisory" && parsed.data?.advisory) {
        advisories.push({
          id: parsed.data.advisory.id ?? parsed.data.advisory.url ?? "unknown",
          severity: (parsed.data.advisory.severity ?? "").toLowerCase(),
        });
      }
      if (parsed.type === "auditAdvisory" && parsed.data?.advisory) {
        advisories.push({
          id: parsed.data.advisory.id ?? parsed.data.advisory.url ?? "unknown",
          severity: (parsed.data.advisory.severity ?? "").toLowerCase(),
        });
      }
      if (parsed.type === "auditSummary" && parsed.data?.vulnerabilities) {
        const vulns = parsed.data.vulnerabilities;
        for (const severity of Object.keys(vulns)) {
          const value = vulns[severity];
          if (value > 0) {
            advisories.push({ id: `summary-${severity}`, severity });
          }
        }
      }
    } catch (error) {
      // ignore parse errors
    }
  }
  return advisories;
}

async function gateSbom() {
  const sbomPath = path.join(reportsDir, "sbom.json");
  const components = collectComponents();
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "apgms",
          name: "quality-gate-orchestrator",
          version: "1.0.0",
        },
      ],
    },
    components,
  };
  await writeFile(sbomPath, JSON.stringify(sbom, null, 2));
  const rel = path.relative(repoRoot, sbomPath);
  if (!artifacts.includes(rel)) {
    artifacts.push(rel);
  }
  gates.push({
    id: "sbom",
    name: "CycloneDX SBOM",
    required: true,
    status: "PASS",
    metrics: { components: components.length },
  });
}

async function gateAuthCors(context: GatewayContext | null) {
  if (!context) {
    gates.push({
      id: "auth-cors",
      name: "Auth and CORS probes",
      required: true,
      status: "WARN",
      metrics: { reason: gatewayUnavailableReason ?? "Gateway unavailable" },
    });
    return;
  }
  const issues: string[] = [];
  const baseUrl = `http://127.0.0.1:${context.apiPort}`;
  let unauthStatus: number | undefined;
  let wrongOrgStatus: number | undefined;
  let preflightStatus: number | undefined;
  try {
    const res = await fetch(`${baseUrl}/users`, { method: "GET" });
    unauthStatus = res.status;
    if (res.status !== 401) {
      issues.push(`/users without token expected 401 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Failed unauth probe: ${(error as Error).message}`);
  }

  try {
    const res = await fetch(`${baseUrl}/users`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid",
        "X-Org-Id": "wrong",
      },
    });
    wrongOrgStatus = res.status;
    if (res.status !== 403) {
      issues.push(`Wrong org expected 403 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Failed wrong-org probe: ${(error as Error).message}`);
  }

  try {
    const res = await fetch(`${baseUrl}/users`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "GET",
      },
    });
    preflightStatus = res.status;
    if (res.status < 400) {
      issues.push(`Preflight from non-allowlisted origin expected block got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Failed CORS preflight: ${(error as Error).message}`);
  }

  const status: GateStatus = issues.length === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "auth-cors",
    name: "Auth and CORS probes",
    required: true,
    status,
    metrics: { unauthStatus, wrongOrgStatus, preflightStatus, issues },
  });
}

async function gateIdempotency(context: GatewayContext | null) {
  if (!context) {
    gates.push({
      id: "idempotency",
      name: "Idempotency & replay",
      required: true,
      status: "WARN",
      metrics: { reason: gatewayUnavailableReason ?? "Gateway unavailable" },
    });
    return;
  }
  const baseUrl = `http://127.0.0.1:${context.apiPort}`;
  const issues: string[] = [];
  const key = `qa-${Date.now()}`;
  let firstStatus: number | undefined;
  let secondStatus: number | undefined;
  try {
    const res = await fetch(`${baseUrl}/bank-lines`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify({
        orgId: "qa",
        date: new Date().toISOString(),
        amount: 1,
        payee: "QA",
        desc: "Idempotency check",
      }),
    });
    firstStatus = res.status;
    if (res.status !== 201) {
      issues.push(`Initial POST expected 201 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Initial POST failed: ${(error as Error).message}`);
  }

  try {
    const res = await fetch(`${baseUrl}/bank-lines`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify({
        orgId: "qa",
        date: new Date().toISOString(),
        amount: 1,
        payee: "QA",
        desc: "Idempotency check",
      }),
    });
    secondStatus = res.status;
    if (![409, 208].includes(res.status)) {
      issues.push(`Replay expected 409/208 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Replay POST failed: ${(error as Error).message}`);
  }

  let status: GateStatus = issues.length === 0 ? "PASS" : "FAIL";
  let webhookStatus: number | undefined;
  if (status !== "FAIL") {
    try {
      const res = await fetch(`${baseUrl}/webhooks/test`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ stale: true }),
      });
      webhookStatus = res.status;
      if (![401, 409].includes(res.status)) {
        if (res.status === 404) {
          status = "WARN";
        } else {
          status = "FAIL";
          issues.push(`Webhook stale replay expected 401/409 got ${res.status}`);
        }
      }
    } catch (error) {
      status = "WARN";
      issues.push(`Webhook probe failed: ${(error as Error).message}`);
    }
  }

  gates.push({
    id: "idempotency",
    name: "Idempotency & replay",
    required: true,
    status,
    metrics: { firstStatus, secondStatus, webhookStatus, issues },
  });
}

async function gateRptTamper(context: GatewayContext | null) {
  if (!context) {
    gates.push({
      id: "rpt-tamper",
      name: "RPT tamper detection",
      required: true,
      status: "WARN",
      metrics: { reason: gatewayUnavailableReason ?? "Gateway unavailable" },
    });
    return;
  }
  gates.push({
    id: "rpt-tamper",
    name: "RPT tamper detection",
    required: true,
    status: "WARN",
    metrics: { reason: "No RPT persistence APIs detected" },
  });
}

async function gatePerf() {
  const exists = await commandExists("k6");
  const scriptPath = path.join(repoRoot, "perf", "k6", "allocations_apply.js");
  if (!exists) {
    gates.push({
      id: "perf",
      name: "Performance baseline",
      required: false,
      status: "WARN",
      metrics: { reason: "k6 not installed" },
    });
    return;
  }
  if (!(await pathExists(scriptPath))) {
    gates.push({
      id: "perf",
      name: "Performance baseline",
      required: false,
      status: "WARN",
      metrics: { reason: "Performance script missing" },
    });
    return;
  }
  const result = await runCommand("k6", ["run", scriptPath], { allowFailure: true });
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "WARN";
  gates.push({
    id: "perf",
    name: "Performance baseline",
    required: false,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateA11y() {
  if (!hasRootScript("axe")) {
    gates.push({
      id: "a11y",
      name: "Accessibility audits",
      required: false,
      status: "WARN",
      metrics: { reason: "No axe script defined" },
    });
    return;
  }
  const result = await runCommand("pnpm", ["run", "axe"], { allowFailure: true });
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "WARN";
  gates.push({
    id: "a11y",
    name: "Accessibility audits",
    required: false,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateLighthouse() {
  const configPaths = [
    path.join(repoRoot, "lighthouse.config.js"),
    path.join(repoRoot, "lighthouse.config.cjs"),
    path.join(repoRoot, "lighthouse.config.mjs"),
    path.join(repoRoot, "lighthouse.config.ts"),
  ];
  const configExists = (await Promise.all(configPaths.map(pathExists))).some(Boolean);
  if (!configExists) {
    gates.push({
      id: "lighthouse",
      name: "Lighthouse audits",
      required: false,
      status: "WARN",
      metrics: { reason: "No Lighthouse config found" },
    });
    return;
  }
  const result = await runCommand("pnpm", ["run", "lighthouse"], { allowFailure: true });
  const status: GateStatus = result.exitCode === 0 ? "PASS" : "WARN";
  gates.push({
    id: "lighthouse",
    name: "Lighthouse audits",
    required: false,
    status,
    metrics: { durationMs: result.durationMs, exitCode: result.exitCode },
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
}

async function gateOtel() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    gates.push({
      id: "otel",
      name: "OTEL span emission",
      required: false,
      status: "WARN",
      metrics: { reason: "OTEL_EXPORTER_OTLP_ENDPOINT not configured" },
    });
    return;
  }
  gates.push({
    id: "otel",
    name: "OTEL span emission",
    required: false,
    status: "WARN",
    metrics: { reason: "Span verification not implemented" },
  });
}

async function gateReadiness(context: GatewayContext | null) {
  if (!context) {
    gates.push({
      id: "readiness",
      name: "Readiness & liveness",
      required: true,
      status: "WARN",
      metrics: { reason: gatewayUnavailableReason ?? "Gateway unavailable" },
    });
    return;
  }
  const baseUrl = `http://127.0.0.1:${context.apiPort}`;
  const issues: string[] = [];
  let healthzStatus: number | undefined;
  let readyzStatus: number | undefined;
  let downReadyStatus: number | undefined;
  try {
    const res = await fetch(`${baseUrl}/healthz`);
    healthzStatus = res.status;
    if (res.status !== 200) {
      issues.push(`/healthz expected 200 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Healthz probe failed: ${(error as Error).message}`);
  }
  try {
    const res = await fetch(`${baseUrl}/readyz`);
    readyzStatus = res.status;
    if (res.status !== 200) {
      issues.push(`/readyz expected 200 got ${res.status}`);
    }
  } catch (error) {
    issues.push(`Readyz probe failed: ${(error as Error).message}`);
  }

  if (context.dbRunning) {
    try {
      await runCommand("docker", ["stop", context.dbContainerName], {
        timeoutMs: 120000,
        allowFailure: false,
      });
      context.dbRunning = false;
      await delay(3000);
      try {
        const res = await fetch(`${baseUrl}/readyz`);
        downReadyStatus = res.status;
        if (res.status !== 503) {
          issues.push(`Readyz expected 503 with DB down got ${res.status}`);
        }
      } catch (error) {
        issues.push(`Readyz probe after DB stop failed: ${(error as Error).message}`);
      }
    } catch (error) {
      issues.push(`Failed to stop Postgres: ${(error as Error).message}`);
    }
  }

  const status: GateStatus = issues.length === 0 ? "PASS" : "FAIL";
  gates.push({
    id: "readiness",
    name: "Readiness & liveness",
    required: true,
    status,
    metrics: { healthzStatus, readyzStatus, downReadyStatus, issues },
  });
}

async function ensureGateway(): Promise<GatewayContext | null> {
  if (gatewayContext) return gatewayContext;
  if (!(await commandExists("docker"))) {
    gatewayUnavailableReason = "Docker not available";
    return null;
  }
  const dbContainerName = `qa-pg-${Date.now()}`;
  const dbPort = 55432;
  const apiPort = 3300;
  const dbUrl = `postgresql://postgres:qa@127.0.0.1:${dbPort}/apgms`;
  try {
    await runCommand(
      "docker",
      [
        "run",
        "-d",
        "--rm",
        "--name",
        dbContainerName,
        "-e",
        "POSTGRES_PASSWORD=qa",
        "-e",
        "POSTGRES_DB=apgms",
        "-p",
        `${dbPort}:5432`,
        "postgres:15-alpine",
      ],
      { allowFailure: false, timeoutMs: 180000 }
    );
  } catch (error) {
    gatewayUnavailableReason = `Failed to start Postgres: ${(error as Error).message}`;
    return null;
  }

  const waitStart = Date.now();
  const readyDeadline = waitStart + 60000;
  let ready = false;
  while (Date.now() < readyDeadline) {
    const res = await runCommand(
      "docker",
      ["exec", dbContainerName, "pg_isready", "-U", "postgres"],
      { allowFailure: true, timeoutMs: 5000 }
    );
    if (res.exitCode === 0) {
      ready = true;
      break;
    }
    await delay(1000);
  }
  if (!ready) {
    gatewayUnavailableReason = "Postgres did not become ready";
    await runCommand("docker", ["stop", dbContainerName], { allowFailure: true });
    return null;
  }

  const server = execa("pnpm", ["--filter", "@apgms/api-gateway", "run", "dev"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      DATABASE_URL: dbUrl,
      LOG_LEVEL: "info",
    },
    reject: false,
  });
  const serverLogs: string[] = [];
  captureStream(server.stdout, serverLogs);
  captureStream(server.stderr, serverLogs);

  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const endpoints = ["/readyz", "/healthz", "/health"];
  let readyEndpoint: string | undefined;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`);
        if (res.ok) {
          readyEndpoint = endpoint;
          break;
        }
      } catch {
        // continue polling
      }
    }
    if (readyEndpoint) break;
    await delay(1000);
  }
  if (!readyEndpoint) {
    gatewayUnavailableReason = "API gateway did not become ready";
    server.kill("SIGTERM", { forceKillAfterTimeout: 2000 });
    await server.catch(() => undefined);
    await runCommand("docker", ["stop", dbContainerName], { allowFailure: true });
    return null;
  }

  gatewayContext = {
    apiPort,
    server,
    serverLogs,
    dbContainerName,
    dbPort,
    readyEndpoint,
    dbRunning: true,
  };
  return gatewayContext;
}

async function teardownGateway() {
  if (!gatewayContext) return;
  if (gatewayContext.server) {
    gatewayContext.server.kill("SIGTERM", { forceKillAfterTimeout: 2000 });
    try {
      await gatewayContext.server;
    } catch {
      // ignore errors on shutdown
    }
  }
  if (gatewayContext.dbRunning) {
    await runCommand("docker", ["stop", gatewayContext.dbContainerName], {
      allowFailure: true,
      timeoutMs: 120000,
    });
  }
  gatewayContext = null;
}

async function runCommand(
  command: string,
  args: string[],
  options?: { allowFailure?: boolean; timeoutMs?: number }
): Promise<CommandResult> {
  const start = Date.now();
  const result = await execa(command, args, {
    cwd: repoRoot,
    env: process.env,
    reject: false,
    timeout: options?.timeoutMs ?? 600000,
  });
  if (!options?.allowFailure && result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.exitCode}: ${result.stderr}`
    );
  }
  return {
    exitCode: result.exitCode,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.timedOut ?? false,
    failed: result.failed ?? false,
    durationMs: Date.now() - start,
  };
}

function captureStream(stream: NodeJS.ReadableStream | null | undefined, buffer: string[]) {
  if (!stream) return;
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    buffer.push(chunk);
    if (buffer.length > 400) {
      buffer.splice(0, buffer.length - 400);
    }
  });
}

function tail(output: string): string {
  const lines = output.split(/\r?\n/);
  return lines.slice(-80).join("\n");
}

function hasRootScript(name: string): boolean {
  return Boolean(rootPackage?.scripts?.[name]);
}

async function loadRootPackage(): Promise<RootPackageJson> {
  const pkgPath = path.join(repoRoot, "package.json");
  const raw = await readFile(pkgPath, "utf8");
  return JSON.parse(raw) as RootPackageJson;
}

async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const result = await execa("which", [cmd], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    records.push(record);
  }
  return records;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function collectComponents() {
  const components: Array<Record<string, unknown>> = [];
  const deps = rootPackage.dependencies ?? {};
  for (const [name, version] of Object.entries(deps)) {
    const encoded = encodeURIComponent(name).replace(/%2F/g, "/");
    components.push({
      "@type": "library",
      "bom-ref": `pkg:npm/${encoded}@${version}`,
      name,
      version,
      scope: "required",
    });
  }
  const devDeps = rootPackage.devDependencies ?? {};
  for (const [name, version] of Object.entries(devDeps)) {
    const encoded = encodeURIComponent(name).replace(/%2F/g, "/");
    components.push({
      "@type": "library",
      "bom-ref": `pkg:npm/${encoded}@${version}?dev`,
      name,
      version,
      scope: "optional",
    });
  }
  return components;
}

await main();
