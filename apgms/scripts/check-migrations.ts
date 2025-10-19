import { spawnSync } from 'node:child_process';

const command = 'pnpm';
const args = ['-w', 'exec', 'prisma', 'migrate', 'status'];

const result = spawnSync(command, args, { stdio: 'pipe' });

if (result.error) {
  console.error('Failed to run prisma migrate status:', result.error);
  process.exit(1);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

const output = (result.stdout ?? Buffer.from('')).toString();

if (!output.toLowerCase().includes('up to date')) {
  console.error('\nPrisma migrations are not up to date.');
  process.exit(1);
}
