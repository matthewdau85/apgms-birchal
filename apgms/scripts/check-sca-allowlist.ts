import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface AllowlistEntry {
  name: string;
  reason: string;
  expires: string;
}

interface AllowlistFile {
  packages: AllowlistEntry[];
}

const allowlistPath = resolve(__dirname, '..', 'security', 'sca-allowlist.json');

let file: AllowlistFile;

try {
  const contents = readFileSync(allowlistPath, 'utf-8');
  file = JSON.parse(contents) as AllowlistFile;
} catch (error) {
  console.error(`Failed to read allowlist file at ${allowlistPath}:`, error);
  process.exit(1);
}

if (!file.packages || !Array.isArray(file.packages)) {
  console.error('Allowlist file is missing a valid "packages" array.');
  process.exit(1);
}

const now = new Date();
const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

const expiredEntries = file.packages.filter((entry) => {
  if (!entry.expires) {
    return true;
  }

  const match = entry.expires.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    console.error(`Entry for ${entry.name} has invalid expires format: ${entry.expires}`);
    return true;
  }

  const [, yearStr, monthStr, dayStr] = match;
  const expiryTime = Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr));

  return expiryTime < todayUtc;
});

if (expiredEntries.length > 0) {
  console.error('Expired SCA allowlist entries found:');
  for (const entry of expiredEntries) {
    console.error(`- ${entry.name} (expires ${entry.expires})`);
  }
  process.exit(1);
}

console.log('SCA allowlist is valid.');
