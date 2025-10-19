#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'docs', 'asvs-map.csv');

function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('ASVS map is empty.');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const requiredHeaders = ['control_id', 'description', 'status', 'evidence_path'];
  const missingHeaders = requiredHeaders.filter((key) => !header.includes(key));
  if (missingHeaders.length) {
    throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}`);
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(',').map((value) => value.trim());
    if (values.length !== header.length) {
      throw new Error(`Invalid column count on line ${index + 2}`);
    }
    const entry = {};
    header.forEach((key, idx) => {
      entry[key] = values[idx];
    });
    return entry;
  });

  return rows;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ASVS map not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  let rows;
  try {
    rows = parseCsv(content);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const validStatuses = new Set(['PASS', 'FAIL', 'NA']);
  const failures = [];
  for (const row of rows) {
    const status = row.status ? row.status.toUpperCase() : '';
    if (!validStatuses.has(status)) {
      console.error(`Invalid status '${row.status}' for control ${row.control_id}`);
      process.exit(1);
    }
    if (status === 'FAIL') {
      failures.push(row);
    }
  }

  if (failures.length) {
    console.error('ASVS controls failing requirements detected:');
    for (const failure of failures) {
      console.error(` - ${failure.control_id}: ${failure.description} (${failure.evidence_path})`);
    }
    process.exit(1);
  }

  console.log('All ASVS controls are passing or not applicable.');
}

main();
