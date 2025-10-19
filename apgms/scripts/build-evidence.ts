import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(__dirname, '..');

function toPosix(input: string): string {
  return input.split(path.sep).join('/');
}

const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage']);

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

type Visitor = (relativePath: string, dirent: import('node:fs').Dirent) => void | Promise<void>;

async function walkDirectory(baseAbsolute: string, relativeBase: string, visitor: Visitor): Promise<void> {
  const entries = await fs.readdir(baseAbsolute, { withFileTypes: true });
  for (const entry of entries) {
    const rel = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    const entryPath = path.join(baseAbsolute, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      await walkDirectory(entryPath, rel, visitor);
    } else if (entry.isFile()) {
      await visitor(rel, entry);
    }
  }
}

async function collectMatchingFiles(relativeRoot: string, predicate: (relativePath: string) => boolean): Promise<string[]> {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  try {
    const stat = await fs.stat(absoluteRoot);
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const matches: string[] = [];
  await walkDirectory(absoluteRoot, '', (rel) => {
    if (predicate(rel)) {
      matches.push(relativeRoot ? `${relativeRoot}/${rel}` : rel);
    }
  });
  return matches;
}

function withinDepth(relativePath: string, maxDepth: number): boolean {
  if (!relativePath) {
    return false;
  }
  const segments = relativePath.split('/');
  return segments.length <= maxDepth;
}

async function main(): Promise<void> {
  const sha = process.env.GITHUB_SHA || (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).then((res) => res.stdout.trim()));
  const evidenceDir = path.join(repoRoot, 'artifacts');
  await fs.mkdir(evidenceDir, { recursive: true });
  const zipName = `evidence-${sha}.zip`;
  const zipPath = path.join(evidenceDir, zipName);
  const zipRelativePath = toPosix(path.relative(repoRoot, zipPath));

  await fs.rm(zipPath, { force: true });

  const sources = new Set<string>();

  const schemaFiles = await collectMatchingFiles('services', (rel) => rel.includes('/src/schemas/') && rel.endsWith('.json'));
  schemaFiles.forEach((file) => sources.add(file));

  const evalReports = await collectMatchingFiles('eval', (rel) => rel.endsWith('-report.json') && !rel.includes('/'));
  evalReports.forEach((file) => sources.add(file));

  const docsMarkdown = await collectMatchingFiles('docs', (rel) => rel.endsWith('.md') && withinDepth(rel, 2));
  docsMarkdown.forEach((file) => sources.add(file));

  const docsYaml = await collectMatchingFiles('docs', (rel) => rel.endsWith('.yaml') && !rel.includes('/'));
  docsYaml.forEach((file) => sources.add(file));

  const supplierYaml = await collectMatchingFiles('docs/suppliers', (rel) => rel.endsWith('.yaml'));
  supplierYaml.forEach((file) => sources.add(file));

  const alertsYaml = await collectMatchingFiles('alerts', (rel) => rel.endsWith('.yaml') && !rel.includes('/'));
  alertsYaml.forEach((file) => sources.add(file));

  const artifactJson = await collectMatchingFiles('artifacts', (rel) => rel.endsWith('.json') && !rel.includes('/'));
  artifactJson.forEach((file) => sources.add(file));

  if (await pathExists('public/accessibility.html')) {
    sources.add('public/accessibility.html');
  }

  if (await pathExists('webapp/src/routes/legal')) {
    sources.add('webapp/src/routes/legal');
  }

  const sourceList = Array.from(sources).sort();

  if (sourceList.length === 0) {
    const placeholder = path.join(evidenceDir, '.placeholder');
    const placeholderRelative = toPosix(path.relative(repoRoot, placeholder));
    await fs.writeFile(placeholder, '');
    try {
      await execFileAsync('zip', ['-q', zipRelativePath, placeholderRelative], { cwd: repoRoot });
      await execFileAsync('zip', ['-q', '-d', zipRelativePath, placeholderRelative], { cwd: repoRoot });
    } finally {
      await fs.rm(placeholder, { force: true });
    }
    return;
  }

  await execFileAsync('zip', ['-q', '-r', zipRelativePath, ...sourceList.map(toPosix)], { cwd: repoRoot });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
