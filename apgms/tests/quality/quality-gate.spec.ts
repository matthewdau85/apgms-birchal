import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "../lib/vitest/index";
import { aggregateQuality, anyFailures, loadGuardrailResults, renderMarkdown } from "@apgms/shared";
import { runQualityGate } from "../../scripts/quality-gate";

describe("quality gate orchestrator", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("aggregates guardrail results and produces markdown", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-"));
    fs.writeFileSync(
      path.join(tempDir, "unit.json"),
      JSON.stringify({ name: "unit", status: "pass" }),
    );
    fs.writeFileSync(
      path.join(tempDir, "golden.json"),
      JSON.stringify({ name: "golden", status: "pass" }),
    );
    fs.writeFileSync(
      path.join(tempDir, "red-team.json"),
      JSON.stringify({ name: "red-team", status: "fail", details: "replay regression" }),
    );

    const results = loadGuardrailResults(tempDir, [
      { name: "unit", path: "unit.json" },
      { name: "golden", path: "golden.json" },
      { name: "red-team", path: "red-team.json" },
    ]);

    const report = aggregateQuality(results);
    expect(report.summary.total).toBe(3);
    expect(report.summary.failed).toBe(1);
    expect(anyFailures(report)).toBe(true);

    const markdown = renderMarkdown(report);
    expect(markdown).toContain("Quality Gate Summary");
    expect(markdown).toContain("red-team");
  });

  test("runQualityGate writes reports and fails on regression", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-"));
    fs.writeFileSync(
      path.join(tempDir, "unit.json"),
      JSON.stringify({ name: "unit", status: "pass" }),
    );
    fs.writeFileSync(
      path.join(tempDir, "golden.json"),
      JSON.stringify({ name: "golden", status: "pass" }),
    );
    fs.writeFileSync(
      path.join(tempDir, "red-team.json"),
      JSON.stringify({ name: "red-team", status: "pass" }),
    );

    const report = runQualityGate(tempDir);
    expect(fs.existsSync(path.join(tempDir, "quality.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "quality.md"))).toBe(true);
    expect(report.summary.failed).toBe(0);

    fs.writeFileSync(
      path.join(tempDir, "red-team.json"),
      JSON.stringify({ name: "red-team", status: "fail", details: "replay regression" }),
    );

    expect(() => runQualityGate(tempDir)).toThrow(/quality gate failed/);
  });
});
