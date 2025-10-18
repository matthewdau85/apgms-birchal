import { readFileSync } from 'fs';
import { resolve } from 'path';

interface AsvsControl {
  ControlId: string;
  Description: string;
  Required: string;
  Status: string;
  EvidencePath: string;
}

const CSV_PATH = resolve(process.cwd(), 'compliance', 'asvs_map.csv');

function parseCsv(content: string): AsvsControl[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const header = lines[0].split(',');
  if (header.length !== 5) {
    throw new Error('ASVS map CSV header must contain exactly five columns.');
  }

  return lines.slice(1).map((line) => {
    const columns = line.split(',');
    if (columns.length !== header.length) {
      throw new Error(`Malformed CSV row: ${line}`);
    }

    const record: AsvsControl = {
      ControlId: columns[0].trim(),
      Description: columns[1].trim(),
      Required: columns[2].trim(),
      Status: columns[3].trim(),
      EvidencePath: columns[4].trim(),
    };

    return record;
  });
}

function formatControl(control: AsvsControl): string {
  return `${control.ControlId} (${control.Description})`;
}

function main(): void {
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const controls = parseCsv(csvContent);

  const failingRequired = controls.filter(
    (control) => control.Required.toLowerCase() === 'yes' && control.Status.toUpperCase() === 'FAIL',
  );

  if (failingRequired.length > 0) {
    console.error('The following required ASVS controls are failing:');
    for (const control of failingRequired) {
      console.error(` - ${formatControl(control)} (Evidence: ${control.EvidencePath})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('All required ASVS controls are passing.');
}

main();
