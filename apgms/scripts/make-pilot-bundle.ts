import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';

interface CollectOptions {
  filter?: (entryName: string) => boolean;
  recursive?: boolean;
}

const repoRoot = resolve(__dirname, '..');

async function ensureFile(path: string) {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      throw new Error(`Expected file at ${path}`);
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing required file: ${path}`);
    }
    throw error;
  }
}

async function ensureDirectory(path: string) {
  try {
    const dirStat = await stat(path);
    if (!dirStat.isDirectory()) {
      throw new Error(`Expected directory at ${path}`);
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing required directory: ${path}`);
    }
    throw error;
  }
}

async function collectFilesFromDirectory(dir: string, options: CollectOptions = {}): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (options.recursive) {
        const nested = await collectFilesFromDirectory(absolutePath, options);
        results.push(...nested);
      }
    } else if (entry.isFile()) {
      if (!options.filter || options.filter(entry.name)) {
        results.push(absolutePath);
      }
    }
  }

  return results;
}

async function zipBundle(files: string[], outputRelativePath: string) {
  await mkdir(join(repoRoot, 'dist'), { recursive: true });
  const absoluteOutputPath = join(repoRoot, outputRelativePath);
  await rm(absoluteOutputPath, { force: true });

  return new Promise<void>((resolvePromise, rejectPromise) => {
    const zipArgs = ['-r', outputRelativePath, ...files];
    const child = spawn('zip', zipArgs, { cwd: repoRoot, stdio: 'inherit' });

    child.on('error', (error) => {
      rejectPromise(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`zip exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const filesToZip: string[] = [];

  const atoDir = join(repoRoot, 'docs', 'ato');
  await ensureDirectory(atoDir);
  const atoMarkdown = await collectFilesFromDirectory(atoDir, {
    filter: (name) => name.endsWith('.md'),
    recursive: false,
  });
  filesToZip.push(...atoMarkdown.map((file) => relative(repoRoot, file)));

  const policiesDir = join(repoRoot, 'policies');
  await ensureDirectory(policiesDir);
  const policyJson = await collectFilesFromDirectory(policiesDir, {
    filter: (name) => name.endsWith('.json'),
    recursive: false,
  });
  filesToZip.push(...policyJson.map((file) => relative(repoRoot, file)));

  const evidenceManifest = join(repoRoot, 'docs', 'ato', 'evidence', 'manifest.json');
  await ensureFile(evidenceManifest);
  filesToZip.push(relative(repoRoot, evidenceManifest));

  const artifactsDir = join(repoRoot, 'tmp', 'as4-artifacts');
  await ensureDirectory(artifactsDir);
  const as4Artifacts = await collectFilesFromDirectory(artifactsDir, {
    recursive: true,
  });
  filesToZip.push(...as4Artifacts.map((file) => relative(repoRoot, file)));

  const additionalFiles = [
    join(repoRoot, 'artifacts', 'audit-sample.ndjson'),
    join(repoRoot, 'eval', 'redteam-report.json'),
    join(repoRoot, 'eval', 'golden-summary.json'),
    join(repoRoot, 'sbom.json'),
    join(repoRoot, 'sca.json'),
  ];

  for (const filePath of additionalFiles) {
    await ensureFile(filePath);
    filesToZip.push(relative(repoRoot, filePath));
  }

  filesToZip.sort();

  const outputRelativePath = join('dist', 'pilot-bundle.zip');
  await zipBundle(filesToZip, outputRelativePath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
