import { promises as fs } from 'fs';
import type { Dirent } from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const skipDirectories = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  '.output',
  'coverage',
  'tmp',
  'logs',
]);

type FileIndex = {
  byName: Map<string, string[]>;
  dockerfiles: string[];
};

let cachedIndex: FileIndex | null = null;

async function buildFileIndex(): Promise<FileIndex> {
  if (cachedIndex) {
    return cachedIndex;
  }

  const byName = new Map<string, string[]>();
  const dockerfiles: string[] = [];
  const pending: string[] = [repoRoot];

  while (pending.length > 0) {
    const current = pending.pop()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      console.warn(`⚠️  Skipping ${path.relative(repoRoot, current) || '.'}: ${(error as Error).message}`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) {
          pending.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const list = byName.get(entry.name) ?? [];
      list.push(fullPath);
      byName.set(entry.name, list);

      if (entry.name === 'Dockerfile' || entry.name.startsWith('Dockerfile.')) {
        dockerfiles.push(fullPath);
      }
    }
  }

  cachedIndex = { byName, dockerfiles };
  return cachedIndex;
}

function formatMatches(paths: string[]): string {
  return paths.map((p) => `- ${path.relative(repoRoot, p)}`).join('\n');
}

async function ensureFileByName(fileName: string, description: string): Promise<void> {
  const { byName } = await buildFileIndex();
  const matches = byName.get(fileName) ?? [];

  if (matches.length === 0) {
    throw new Error(`Missing ${description}. Expected a file named \"${fileName}\" somewhere in the repository.`);
  }

  console.log(`✅ ${description} found:\n${formatMatches(matches)}`);
}

async function ensureOpenApi(): Promise<void> {
  await ensureFileByName('openapi.json', 'OpenAPI specification');
}

async function ensureDockerfiles(): Promise<void> {
  const { dockerfiles } = await buildFileIndex();
  if (dockerfiles.length === 0) {
    throw new Error('Missing Dockerfile. At least one Dockerfile* must be present.');
  }

  console.log(`✅ Dockerfile(s) found:\n${formatMatches(dockerfiles)}`);
}

async function ensureK6Assets(): Promise<void> {
  const k6Dir = path.join(repoRoot, 'k6');
  let entries: Dirent[];
  try {
    entries = await fs.readdir(k6Dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Missing k6 directory at ${path.relative(repoRoot, k6Dir)}.`);
  }

  const hasArtifacts = entries.some((entry) => !entry.name.startsWith('.') && (entry.isFile() || entry.isDirectory()));
  if (!hasArtifacts) {
    throw new Error('k6 directory exists but contains no test assets.');
  }

  console.log(`✅ k6 assets found:\n${entries.map((entry) => `- ${path.join('k6', entry.name)}`).join('\n')}`);
}

async function main(): Promise<void> {
  const checks: Array<[string, () => Promise<void>]> = [
    ['Authentication module', () => ensureFileByName('auth.ts', 'Authentication module')],
    ['Organisation scope module', () => ensureFileByName('org-scope.ts', 'Organisation scope module')],
    ['Bank lines handler', () => ensureFileByName('bank-lines.ts', 'Bank lines handler')],
    ['Idempotency utilities', () => ensureFileByName('idempotency.ts', 'Idempotency utilities')],
    ['Configuration surface', () => ensureFileByName('config.ts', 'Configuration surface')],
    ['OpenAPI document', ensureOpenApi],
    ['Dockerfiles', ensureDockerfiles],
    ['k6 assets', ensureK6Assets],
  ];

  for (const [name, check] of checks) {
    try {
      await check();
    } catch (error) {
      console.error(`❌ ${name} check failed: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }

  if (process.exitCode === 1) {
    throw new Error('Green readiness verification failed.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
