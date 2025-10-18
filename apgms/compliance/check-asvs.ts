import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type AsvsRow = {
  ControlID: string;
  Category: string;
  Description: string;
  Required: string;
  Status: string;
  EvidencePath: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const csvPath = resolve(__dirname, 'asvs_map.csv');

function parseCsv(content: string): AsvsRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(',').map((cell) => cell.trim());
  const rows: AsvsRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((cell) => cell.trim());
    if (cells.length !== headers.length) {
      throw new Error(`Malformed CSV line: ${line}`);
    }

    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]])) as AsvsRow;
    rows.push(row);
  }

  return rows;
}

function isRequired(value: string): boolean {
  return value.trim().length > 0 && value.trim().toLowerCase() !== 'no' && value.trim().toLowerCase() !== 'false';
}

function isFail(value: string): boolean {
  return value.trim().toUpperCase() === 'FAIL';
}

function main(): void {
  let content: string;
  try {
    content = readFileSync(csvPath, 'utf-8');
  } catch (error) {
    console.error(`Unable to read ASVS mapping file at ${csvPath}`);
    throw error;
  }

  const rows = parseCsv(content);

  const failingControls = rows.filter((row) => isRequired(row.Required) && isFail(row.Status));

  if (failingControls.length > 0) {
    console.error('Required ASVS controls are marked as FAIL:');
    for (const control of failingControls) {
      console.error(` - ${control.ControlID} (${control.Description}) -> ${control.EvidencePath}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('All required ASVS controls are passing.');
}

main();
