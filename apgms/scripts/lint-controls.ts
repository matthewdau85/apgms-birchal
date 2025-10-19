import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ControlRecord {
  file: string;
  line: number;
  controlId: string;
  description: string;
  status: string;
  evidence: string;
}

const CSV_FILES = [
  "docs/asvs-map.csv",
  "docs/osf-map.csv",
];

const ALLOWED_STATUSES = new Set(["PASS", "FAIL", "NA"]);

function parseCsv(file: string): ControlRecord[] {
  const abs = resolve(process.cwd(), file);
  const raw = readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const records: ControlRecord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split(",");
    if (parts.length < 4) {
      throw new Error(`Invalid row in ${file} at line ${i + 1}: ${line}`);
    }
    const [controlId, description, status, evidence] = parts.map((value) => value.trim());
    records.push({
      file,
      line: i + 1,
      controlId,
      description,
      status,
      evidence,
    });
  }
  return records;
}

const violations: string[] = [];

for (const csv of CSV_FILES) {
  const records = parseCsv(csv);
  for (const record of records) {
    if (!ALLOWED_STATUSES.has(record.status)) {
      violations.push(
        `${record.file}:${record.line} ${record.controlId} has invalid status "${record.status}". Expected PASS, FAIL, or NA.`,
      );
      continue;
    }
    if (record.status !== "NA" && record.status !== "PASS") {
      violations.push(
        `${record.file}:${record.line} ${record.controlId} is marked ${record.status}. Required controls must be PASS.`,
      );
    }
    if (!record.evidence) {
      violations.push(`${record.file}:${record.line} ${record.controlId} is missing an evidence link.`);
    }
  }
}

if (violations.length > 0) {
  console.error("Control lint failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("All control mappings passed lint.");
