#!/usr/bin/env node

// Lightweight CycloneDX generator tailored for the APGMS workspace.
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { output: 'sbom.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if ((current === '--output' || current === '-o') && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readPackageJson(location) {
  const filePath = path.resolve(location);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unable to locate package.json at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeComponent([name, version]) {
  return {
    type: 'library',
    name,
    version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
  };
}

function buildComponents(pkg) {
  const components = [];
  const pairs = Object.entries({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  for (const pair of pairs) {
    components.push(normalizeComponent(pair));
  }
  return components;
}

function createBom(pkg) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'apgms',
          name: 'cyclonedx-bom-shim',
          version: '0.0.0',
        },
      ],
      component: {
        type: 'application',
        name: pkg.name || 'apgms',
        version: pkg.version || '0.0.0',
      },
    },
    components: buildComponents(pkg),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let pkg;
  try {
    pkg = readPackageJson(path.join(process.cwd(), 'package.json'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const bom = createBom(pkg);
  const outputPath = path.resolve(process.cwd(), args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(bom, null, 2));
  console.log(`CycloneDX SBOM written to ${outputPath}`);
}

main();
