#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = process.env.SECURITY_REPORT_DIR ?? "security-reports";
const allowlistPath = process.env.VULNERABILITY_ALLOWLIST ?? "apgms/security/vulnerability-allowlist.json";

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`Unable to read JSON from ${path}:`, error);
    process.exit(1);
  }
}

function loadAllowlist(path) {
  const allowlist = loadJson(path);
  const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
  const now = new Date();
  const allowed = new Set();
  const expired = [];
  for (const entry of entries) {
    if (!entry?.id) continue;
    if (entry.expires && new Date(entry.expires) < now) {
      expired.push(entry);
      continue;
    }
    allowed.add(String(entry.id));
  }
  return { allowed, expired };
}

function collectTrivyFindings(path) {
  if (!existsSync(path)) return [];
  const data = loadJson(path);
  const findings = [];
  const results = Array.isArray(data.Results) ? data.Results : [];
  for (const result of results) {
    const vulns = Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities : [];
    for (const vuln of vulns) {
      const severity = String(vuln.Severity || "UNKNOWN").toUpperCase();
      findings.push({
        id: vuln.VulnerabilityID,
        source: "trivy",
        severity,
        package: vuln.PkgName,
        version: vuln.InstalledVersion,
        location: result.Target,
        title: vuln.Title ?? "",
        url: Array.isArray(vuln.PrimaryURL ? [vuln.PrimaryURL] : vuln.References) && (vuln.PrimaryURL ?? (vuln.References ?? [])[0]) || ""
      });
    }
  }
  return findings;
}

function collectGrypeFindings(path) {
  if (!existsSync(path)) return [];
  const data = loadJson(path);
  const matches = Array.isArray(data.matches) ? data.matches : [];
  return matches.map((match) => ({
    id: match.vulnerability?.id,
    source: "grype",
    severity: String(match.vulnerability?.severity || "UNKNOWN").toUpperCase(),
    package: match.artifact?.name,
    version: match.artifact?.version,
    location: match.artifact?.type,
    title: match.vulnerability?.description ?? "",
    url: Array.isArray(match.vulnerability?.urls) && match.vulnerability.urls.length > 0 ? match.vulnerability.urls[0] : ""
  }));
}

const reports = {
  trivy: join(REPORT_DIR, "trivy-report.json"),
  grype: join(REPORT_DIR, "grype-report.json"),
};

const sbomPath = join(REPORT_DIR, "sbom.cdx.json");

const { allowed, expired } = loadAllowlist(allowlistPath);
const findings = [...collectTrivyFindings(reports.trivy), ...collectGrypeFindings(reports.grype)];

const violations = findings.filter((finding) => {
  if (!finding.id) return false;
  if (["HIGH", "CRITICAL"].includes(finding.severity) && !allowed.has(finding.id)) {
    return true;
  }
  return false;
});

const summaryLines = [];
summaryLines.push(`# Security Scan Summary`);
summaryLines.push(`Generated: ${new Date().toISOString()}`);
summaryLines.push("");
summaryLines.push(`* SBOM: ${sbomPath}`);
summaryLines.push(`* Trivy report: ${reports.trivy}`);
summaryLines.push(`* Grype report: ${reports.grype}`);
summaryLines.push("");

if (expired.length > 0) {
  summaryLines.push(`## ⚠️ Expired allowlist entries (${expired.length})`);
  for (const entry of expired) {
    summaryLines.push(`- ${entry.id} (expired ${entry.expires}) — ${entry.reason ?? "no reason provided"}`);
  }
  summaryLines.push("");
}

if (violations.length === 0) {
  summaryLines.push(`## ✅ No unapproved high or critical findings detected.`);
} else {
  summaryLines.push(`## ❌ Unapproved high/critical findings (${violations.length})`);
  summaryLines.push("| ID | Source | Severity | Package | Version | Location | Notes |");
  summaryLines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const finding of violations) {
    const notes = finding.url ? `[link](${finding.url})` : "";
    summaryLines.push(`| ${finding.id} | ${finding.source} | ${finding.severity} | ${finding.package ?? ""} | ${finding.version ?? ""} | ${finding.location ?? ""} | ${notes} |`);
  }
}

mkdirSync(REPORT_DIR, { recursive: true });
const summaryPath = join(REPORT_DIR, "scan-summary.md");
writeFileSync(summaryPath, summaryLines.join("\n") + "\n");

if (violations.length > 0 || expired.length > 0) {
  console.error(`Security scan enforcement failed: ${violations.length} violations, ${expired.length} expired allowlist entries.`);
  process.exit(1);
}

console.log(`Security scans passed with ${findings.length} total findings and 0 unapproved high/critical issues.`);

