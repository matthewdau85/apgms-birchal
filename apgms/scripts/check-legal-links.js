#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const readmePath = path.resolve(__dirname, '..', 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');

const requiredLinks = [
  ['(docs/legal/terms.md)', '(apgms/docs/legal/terms.md)'],
  ['(docs/legal/privacy.md)', '(apgms/docs/legal/privacy.md)'],
  ['(docs/legal/dpa.md)', '(apgms/docs/legal/dpa.md)'],
];

const missing = requiredLinks.filter(([primary, alt]) => {
  return !readme.includes(primary) && !readme.includes(alt);
}).map(([primary]) => primary);

if (missing.length > 0) {
  console.error('Missing legal document links in README:', missing.join(', '));
  process.exit(1);
}

console.log('All required legal document links are present in README.');
