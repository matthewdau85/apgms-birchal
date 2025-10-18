import fs from "node:fs";
import path from "node:path";

export interface GuardrailFile {
  name: string;
  path: string;
  optional?: boolean;
}

export interface GuardrailResult {
  name: string;
  status: "pass" | "fail";
  details?: string;
  meta?: Record<string, unknown>;
}

export interface QualityReport {
  generatedAt: string;
  guardrails: GuardrailResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export function loadGuardrailResults(baseDir: string, files: GuardrailFile[]): GuardrailResult[] {
  return files.map((file) => {
    const target = path.resolve(baseDir, file.path);
    if (!fs.existsSync(target)) {
      return {
        name: file.name,
        status: file.optional ? "pass" : "fail",
        details: file.optional ? "optional_guardrail_missing" : "missing_guardrail_report",
      } satisfies GuardrailResult;
    }

    try {
      const raw = fs.readFileSync(target, "utf8");
      const parsed = JSON.parse(raw) as GuardrailResult | { status: string; details?: string };
      const status = parsed.status === "pass" ? "pass" : parsed.status === "fail" ? "fail" : "fail";
      return {
        name: file.name,
        status,
        details: parsed.details,
        meta: "meta" in parsed && typeof parsed.meta === "object" ? (parsed.meta as Record<string, unknown>) : undefined,
      } satisfies GuardrailResult;
    } catch (error) {
      return {
        name: file.name,
        status: "fail",
        details: `invalid_report:${String(error)}`,
      } satisfies GuardrailResult;
    }
  });
}

export function aggregateQuality(guardrails: GuardrailResult[]): QualityReport {
  const passed = guardrails.filter((result) => result.status === "pass").length;
  const failed = guardrails.length - passed;
  return {
    generatedAt: new Date().toISOString(),
    guardrails,
    summary: {
      total: guardrails.length,
      passed,
      failed,
    },
  };
}

export function renderMarkdown(report: QualityReport): string {
  const lines = [
    `# Quality Gate Summary`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Guardrail | Status | Details |",
    "| --- | --- | --- |",
    ...report.guardrails.map((guardrail) => {
      const status = guardrail.status === "pass" ? "✅ Pass" : "❌ Fail";
      const details = guardrail.details ?? "";
      return `| ${guardrail.name} | ${status} | ${details} |`;
    }),
    "",
    `**Total:** ${report.summary.total} • **Passed:** ${report.summary.passed} • **Failed:** ${report.summary.failed}`,
  ];
  return lines.join("\n");
}

export function anyFailures(report: QualityReport): boolean {
  return report.guardrails.some((guardrail) => guardrail.status === "fail");
}
