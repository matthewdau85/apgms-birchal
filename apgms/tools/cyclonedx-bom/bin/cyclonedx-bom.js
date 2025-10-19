#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let outputPath;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '-o' || arg === '--output') {
    outputPath = args[i + 1];
    i += 1;
  }
}

const cwd = process.cwd();
const manifestPath = path.join(cwd, 'package.json');
if (!fs.existsSync(manifestPath)) {
  console.error('package.json not found in current working directory');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function listDependencies(pkg) {
  const result = new Map();
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  for (const key of sections) {
    if (!pkg[key]) continue;
    for (const [name, version] of Object.entries(pkg[key])) {
      result.set(name, version);
    }
  }
  return result;
}

const dependencies = listDependencies(manifest);

const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

function findWorkspaceVersion(rootDir, packageName) {
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    let stats;
    try {
      stats = fs.statSync(current);
    } catch (error) {
      continue;
    }
    if (!stats.isDirectory()) continue;
    const base = path.basename(current);
    if (ignoreDirs.has(base) && current !== rootDir) continue;
    const pkgFile = path.join(current, 'package.json');
    if (fs.existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        if (pkg.name === packageName && pkg.version) {
          return pkg.version;
        }
      } catch (error) {
        // ignore malformed package files
      }
    }
    for (const entry of fs.readdirSync(current)) {
      const nextPath = path.join(current, entry);
      if (ignoreDirs.has(entry)) continue;
      queue.push(nextPath);
    }
  }
  return undefined;
}

const components = Array.from(dependencies.entries())
  .map(([name, spec]) => {
    let version = spec;
    if (typeof version === 'string' && version.startsWith('workspace:')) {
      const resolved = findWorkspaceVersion(cwd, name);
      version = resolved || version.replace(/^workspace:/, '') || '0.0.0';
    }
    return {
      type: 'library',
      name,
      version: typeof version === 'string' ? version : String(version)
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: manifest.name || 'application',
      version: manifest.version || '0.0.0'
    }
  },
  components
};

const data = `${JSON.stringify(bom, null, 2)}\n`;

if (outputPath) {
  const resolved = path.isAbsolute(outputPath) ? outputPath : path.join(cwd, outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, data, 'utf8');
} else {
  process.stdout.write(data);
}
