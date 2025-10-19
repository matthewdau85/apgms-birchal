import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function generateHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function rotateInEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) {
    console.log(`[key-rotate] No .env found at ${envPath}. Printing new secret to stdout.`);
    console.log(`JWT_SECRET=${generateHex(32)}`);
    return;
  }
  const backupPath = envPath + '.bak.' + Date.now();
  fs.copyFileSync(envPath, backupPath);
  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (/^\s*JWT_SECRET\s*=/.test(line)) { found = true; return `JWT_SECRET=${generateHex(32)}`; }
    return line;
  });
  if (!found) next.push(`JWT_SECRET=${generateHex(32)}`);
  fs.writeFileSync(envPath, next.join('\n'), 'utf8');
  console.log(`[key-rotate] Rotated JWT_SECRET in ${envPath}`);
  console.log(`[key-rotate] Backup created at ${backupPath}`);
}

function main() {
  const repoRoot = process.cwd();
  const envPath = path.join(repoRoot, '.env');
  rotateInEnvFile(envPath);
}
main();
