#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'services', 'connectors', 'config.json');
const docsDir = path.join(rootDir, 'docs', 'suppliers');
const requiredFiles = ['README.md', 'template.md'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  fail(`Connector configuration not found at ${configPath}`);
}

let config;
try {
  const contents = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(contents);
} catch (error) {
  fail(`Unable to parse connector configuration: ${error.message}`);
}

if (!config || !Array.isArray(config.connectors)) {
  fail('Connector configuration must include a "connectors" array.');
}

if (!fs.existsSync(docsDir)) {
  fail(`Suppliers documentation directory missing: ${docsDir}`);
}

const missingDocs = [];

for (const file of requiredFiles) {
  const filePath = path.join(docsDir, file);
  if (!fs.existsSync(filePath)) {
    missingDocs.push(`Missing required file: docs/suppliers/${file}`);
  }
}

for (const connector of config.connectors) {
  if (!connector || typeof connector.slug !== 'string' || connector.slug.trim() === '') {
    missingDocs.push('Connector entry missing valid "slug" value.');
    continue;
  }
  const docPath = path.join(docsDir, `${connector.slug}.md`);
  if (!fs.existsSync(docPath)) {
    missingDocs.push(`Missing documentation for connector: docs/suppliers/${connector.slug}.md`);
  }
}

if (missingDocs.length > 0) {
  missingDocs.forEach((msg) => console.error(msg));
  process.exit(1);
}

console.log('All supplier documentation files are present.');
