#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const auditReportPath = process.argv[2] ?? 'audit.json';
const allowlistPath = process.argv[3] ?? 'compliance/allowlist-audit.json';

function loadJson(path, fallback = {}) {
  if (!existsSync(path)) {
    return fallback;
  }
  const data = readFileSync(path, 'utf8');
  if (!data.trim().length) {
    return fallback;
  }
  const firstBrace = data.indexOf('{');
  const firstBracket = data.indexOf('[');
  const startIndex = [firstBrace, firstBracket]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const lastBrace = data.lastIndexOf('}');
  const lastBracket = data.lastIndexOf(']');
  const endIndexCandidates = [lastBrace, lastBracket].filter((index) => index >= 0);
  const endIndex = endIndexCandidates.length ? Math.max(...endIndexCandidates) : undefined;
  const jsonPayload =
    startIndex !== undefined && endIndex !== undefined && endIndex >= startIndex
      ? data.slice(startIndex, endIndex + 1)
      : startIndex !== undefined
        ? data.slice(startIndex)
        : data;
  try {
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error(`Unable to parse JSON from ${path}: ${(error && error.message) || error}`);
    throw error;
  }
}

const auditReport = loadJson(auditReportPath, null);
if (!auditReport) {
  console.error(`Audit report not found at ${auditReportPath}`);
  process.exit(1);
}

if (auditReport.error) {
  console.error('npm audit did not complete successfully:');
  if (auditReport.error.summary) {
    console.error(`- ${auditReport.error.summary}`);
  }
  if (auditReport.error.detail) {
    console.error(auditReport.error.detail);
  }
  process.exit(1);
}

const allowlistRaw = loadJson(allowlistPath, { allowlist: [] });
const allowlistEntries = Array.isArray(allowlistRaw)
  ? allowlistRaw
  : Array.isArray(allowlistRaw.allowlist)
    ? allowlistRaw.allowlist
    : [];
const allowlist = new Set(allowlistEntries.map((entry) => String(entry)));

const severitiesToBlock = new Set(['high', 'critical']);

function extractIdentifiers(record) {
  if (!record) {
    return [];
  }
  const identifiers = new Set();
  const queue = Array.isArray(record.via) ? record.via : [];
  for (const viaEntry of queue) {
    if (!viaEntry) {
      continue;
    }
    if (typeof viaEntry === 'string') {
      identifiers.add(viaEntry);
      continue;
    }
    if (viaEntry.source) {
      identifiers.add(String(viaEntry.source));
    }
    if (viaEntry.id) {
      identifiers.add(String(viaEntry.id));
    }
    if (viaEntry.url) {
      identifiers.add(String(viaEntry.url));
    }
    if (viaEntry.name) {
      identifiers.add(String(viaEntry.name));
    }
  }
  if (record.id) {
    identifiers.add(String(record.id));
  }
  if (record.source) {
    identifiers.add(String(record.source));
  }
  if (record.github_advisory_id) {
    identifiers.add(String(record.github_advisory_id));
  }
  return Array.from(identifiers);
}

const violations = [];

if (auditReport.vulnerabilities && typeof auditReport.vulnerabilities === 'object') {
  for (const [moduleName, vulnerability] of Object.entries(auditReport.vulnerabilities)) {
    const severity = String(vulnerability.severity ?? '').toLowerCase();
    if (!severitiesToBlock.has(severity)) {
      continue;
    }
    const identifiers = extractIdentifiers(vulnerability);
    const isAllowlisted = identifiers.some((id) => allowlist.has(id));
    if (!isAllowlisted) {
      violations.push({
        module: moduleName,
        severity,
        identifiers,
        title: vulnerability.title ?? moduleName,
      });
    }
  }
}

if (auditReport.advisories && typeof auditReport.advisories === 'object') {
  for (const advisory of Object.values(auditReport.advisories)) {
    const severity = String(advisory.severity ?? '').toLowerCase();
    if (!severitiesToBlock.has(severity)) {
      continue;
    }
    const identifiers = extractIdentifiers(advisory);
    if (advisory.github_advisory_id) {
      identifiers.push(String(advisory.github_advisory_id));
    }
    if (advisory.url) {
      identifiers.push(String(advisory.url));
    }
    const isAllowlisted = identifiers.some((id) => allowlist.has(id));
    if (!isAllowlisted) {
      violations.push({
        module: advisory.module_name ?? advisory.title ?? 'unknown',
        severity,
        identifiers,
        title: advisory.title ?? advisory.module_name ?? 'npm advisory',
      });
    }
  }
}

if (violations.length > 0) {
  console.error('High or critical vulnerabilities detected by npm audit that are not allowlisted:');
  for (const violation of violations) {
    const ids = violation.identifiers.length ? ` [${violation.identifiers.join(', ')}]` : '';
    console.error(`- ${violation.title} (${violation.module}) severity: ${violation.severity}${ids}`);
  }
  console.error('\nTo allowlist a vulnerability, add its identifier to the allowlist array in compliance/allowlist-audit.json.');
  process.exit(1);
}

console.log('npm audit passed: no unallowlisted high or critical vulnerabilities found.');
