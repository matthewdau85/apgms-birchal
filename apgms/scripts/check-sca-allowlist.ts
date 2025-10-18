#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const filePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  fileURLToPath(new URL('../compliance/sca-allowlist.json', import.meta.url))
);

async function main() {
  const raw = await readFile(filePath, 'utf8');
  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse sca-allowlist.json:', error);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(data)) {
    console.error('SCA allowlist must be an array of exception objects.');
    process.exitCode = 1;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threshold = today.getTime();

  const expiredEntries: Array<{ pkg: string; version: string; expires: string; owner: string; reason: string }> = [];
  const invalidEntries: string[] = [];

  for (const [index, rawEntry] of data.entries()) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      invalidEntries.push(`Entry at index ${index} is not an object.`);
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
    const requiredFields = ['pkg', 'version', 'reason', 'owner', 'expires'] as const;
    const missingFields = requiredFields.filter((field) => {
      const value = entry[field];
      return typeof value !== 'string' || value.trim() === '';
    });

    if (missingFields.length > 0) {
      const pkgName = typeof entry.pkg === 'string' && entry.pkg.trim() ? entry.pkg : `index ${index}`;
      invalidEntries.push(`Entry for ${pkgName} is missing fields: ${missingFields.join(', ')}.`);
      continue;
    }

    const pkg = entry.pkg as string;
    const version = entry.version as string;
    const reason = entry.reason as string;
    const owner = entry.owner as string;
    const expires = entry.expires as string;

    const expiryDate = new Date(expires);

    if (Number.isNaN(expiryDate.getTime())) {
      invalidEntries.push(`Entry for ${pkg} has invalid expiration date: ${expires}.`);
      continue;
    }

    if (expiryDate.getTime() < threshold) {
      expiredEntries.push({ pkg, version, expires, owner, reason });
    }
  }

  if (invalidEntries.length > 0) {
    console.error('Invalid SCA allowlist entries found:');
    for (const message of invalidEntries) {
      console.error(` - ${message}`);
    }
  }

  if (expiredEntries.length > 0) {
    console.error('Expired SCA allowlist entries detected:');
    for (const entry of expiredEntries) {
      console.error(` - ${entry.pkg}@${entry.version} (expired ${entry.expires}) owned by ${entry.owner}: ${entry.reason}`);
    }
  }

  if (invalidEntries.length > 0 || expiredEntries.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unexpected error while validating SCA allowlist:', error);
  process.exit(1);
});
