#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let outputPath = 'bom.json';
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if ((arg === '-o' || arg === '--output') && i + 1 < args.length) {
    outputPath = args[i + 1];
    i += 1;
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
const packagePath = path.join(repoRoot, 'package.json');
if (!fs.existsSync(packagePath)) {
  console.error('Unable to locate package.json to build SBOM.');
  process.exit(1);
}

const rootPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const collectDependencies = () => {
  const components = new Map();

  const addDeps = (deps, source) => {
    if (!deps) return;
    for (const [name, version] of Object.entries(deps)) {
      const key = `${name}@${version}`;
      if (!components.has(key)) {
        components.set(key, {
          type: 'library',
          name,
          version,
          bomRef: key,
          purl: createPurl(name, version),
          scope: source
        });
      }
    }
  };

  addDeps(rootPackage.dependencies, 'required');
  addDeps(rootPackage.devDependencies, 'optional');

  const workspacePaths = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  for (const workspace of workspacePaths) {
    if (workspace.includes('*')) {
      const [base] = workspace.split('*', 1);
      const baseDir = path.join(repoRoot, base);
      if (!fs.existsSync(baseDir)) continue;
      for (const entry of fs.readdirSync(baseDir)) {
        const candidate = path.join(baseDir, entry);
        if (fs.statSync(candidate).isDirectory()) {
          const pkgFile = path.join(candidate, 'package.json');
          if (fs.existsSync(pkgFile)) {
            const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
            addDeps(pkg.dependencies, 'workspace');
            addDeps(pkg.optionalDependencies, 'workspace');
          }
        }
      }
    } else {
      const pkgFile = path.join(repoRoot, workspace, 'package.json');
      if (fs.existsSync(pkgFile)) {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        addDeps(pkg.dependencies, 'workspace');
        addDeps(pkg.optionalDependencies, 'workspace');
      }
    }
  }

  return Array.from(components.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const createPurl = (name, version) => {
  if (!name || !version) return undefined;
  const normalized = name.startsWith('@')
    ? `%40${name.slice(1).replace('/', '%2F')}`
    : encodeURIComponent(name);
  return `pkg:npm/${normalized}@${version}`;
};

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'apgms',
        name: 'local-cyclonedx-generator',
        version: '0.0.1'
      }
    ],
    component: {
      bomRef: rootPackage.name || 'root-application',
      type: 'application',
      name: rootPackage.name || 'application',
      version: rootPackage.version || '0.0.0',
      purl: createPurl(rootPackage.name, rootPackage.version)
    }
  },
  components: collectDependencies()
};

const destination = path.resolve(repoRoot, outputPath);
fs.writeFileSync(destination, JSON.stringify(bom, null, 2));
console.log(`CycloneDX SBOM written to ${destination}`);
