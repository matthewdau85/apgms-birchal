#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const auditPath = path.resolve(__dirname, '..', 'audit.json');
const allowlistPath = path.resolve(__dirname, '..', 'audit-allowlist.json');

if (!fs.existsSync(auditPath)) {
  console.error('audit.json not found. Run `npm run sca` before checking.');
  process.exit(1);
}

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
let allowlist = [];
if (fs.existsSync(allowlistPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
    if (Array.isArray(parsed)) {
      allowlist = parsed.map(String);
    } else {
      console.warn('audit-allowlist.json is not an array. Ignoring.');
    }
  } catch (err) {
    console.warn('Failed to parse audit-allowlist.json. Ignoring.');
  }
}
const allowlistSet = new Set(allowlist);

const severityRank = new Map([
  ['info', 0],
  ['low', 1],
  ['moderate', 2],
  ['medium', 2],
  ['high', 3],
  ['critical', 4]
]);
const threshold = severityRank.get('high');

const findings = new Map();

const addFinding = (id, severity, details = {}) => {
  const sevValue = severityRank.get(String(severity || '').toLowerCase()) || 0;
  if (sevValue < threshold) {
    return;
  }
  const candidates = [];
  if (Array.isArray(id)) {
    candidates.push(...id.filter(Boolean).map(String));
  } else {
    candidates.push(String(id || '').trim());
  }
  const isAllowed = candidates.some(candidate => allowlistSet.has(candidate));
  if (isAllowed) {
    return;
  }
  const key = candidates.find(Boolean) || `unidentified-${findings.size + 1}`;
  if (!findings.has(key)) {
    findings.set(key, { severity: severity || 'unknown', ...details });
  }
};

const processVulnerabilities = () => {
  if (!audit || typeof audit !== 'object') {
    return;
  }
  if (audit.vulnerabilities && typeof audit.vulnerabilities === 'object') {
    for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
      const viaList = Array.isArray(vuln.via) ? vuln.via : [];
      if (viaList.length === 0) {
        addFinding(`${pkg}@${vuln.range || ''}`, vuln.severity, { package: pkg });
        continue;
      }
      for (const via of viaList) {
        if (typeof via === 'string') {
          addFinding(via, vuln.severity, { package: pkg });
          continue;
        }
        if (via && typeof via === 'object') {
          const severity = via.severity || via.cvss?.severity || vuln.severity;
          const ids = [
            via.id,
            via.source,
            via.url,
            via.name,
            via.title
          ].filter(Boolean).map(String);
          if (ids.length === 0) {
            ids.push(`${pkg}:${via.dependency || ''}`);
          }
          addFinding(ids, severity, { package: pkg });
        }
      }
    }
  }
  if (audit.advisories && typeof audit.advisories === 'object') {
    for (const advisory of Object.values(audit.advisories)) {
      if (!advisory) continue;
      const severity = advisory.severity;
      const ids = [
        advisory.id,
        advisory.cwe,
        advisory.url,
        advisory.module_name,
        advisory.title
      ].filter(Boolean).map(String);
      addFinding(ids, severity, { package: advisory.module_name });
    }
  }
};

processVulnerabilities();

if (findings.size > 0) {
  console.error('High severity vulnerabilities found that are not allowlisted:');
  for (const [id, info] of findings.entries()) {
    console.error(`- ${id} (severity: ${info.severity}${info.package ? `, package: ${info.package}` : ''})`);
  }
  process.exit(1);
}

console.log('No high or critical vulnerabilities outside the allowlist.');
