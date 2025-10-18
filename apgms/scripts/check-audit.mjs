import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const auditFile = process.argv[2] ?? join(__dirname, '..', 'audit.json');
const allowlistFile = join(__dirname, '..', 'compliance', 'allowlist-audit.json');

const loadJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load JSON file at ${path}: ${error.message}`);
  }
};

const auditData = loadJson(auditFile);
const allowlist = new Set(loadJson(allowlistFile));

const vulnerabilities = auditData?.vulnerabilities ?? {};
const severitiesToCheck = new Set(['high', 'critical']);

const offending = [];

for (const [name, details] of Object.entries(vulnerabilities)) {
  if (!details) continue;
  const severity = String(details.severity ?? '').toLowerCase();
  if (!severitiesToCheck.has(severity)) continue;

  const candidateIds = new Set();

  if (details.id !== undefined && details.id !== null) {
    candidateIds.add(String(details.id));
  }

  const viaList = Array.isArray(details.via) ? details.via : [];
  for (const via of viaList) {
    if (typeof via === 'string') {
      candidateIds.add(via);
      continue;
    }
    if (via && (via.source || via.id)) {
      candidateIds.add(String(via.source ?? via.id));
    }
  }

  if (candidateIds.size === 0) {
    candidateIds.add(name);
  }

  const ids = Array.from(candidateIds);
  const isAllowed = ids.every((id) => allowlist.has(id));

  if (!isAllowed) {
    offending.push({ name, severity, ids });
  }
}

if (offending.length > 0) {
  console.error('High or critical vulnerabilities detected that are not allowlisted:');
  for (const issue of offending) {
    console.error(`- ${issue.name} (severity: ${issue.severity}) -> IDs: ${issue.ids.join(', ')}`);
  }
  process.exit(1);
}

console.log('No unallowlisted high or critical vulnerabilities detected.');
