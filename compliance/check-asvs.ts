import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ControlRecord {
  control: string;
  description: string;
  status: "PASS" | "FAIL" | "NA";
  evidencePath: string;
}

const VALID_STATUSES = new Set(["PASS", "FAIL", "NA"]);
const NON_WEB_CONTROLS = new Set([
  "V2.7.1",
  "V2.8.1",
  "V2.9.1",
]);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values.map((value) => value.trim());
}

function readControls(): ControlRecord[] {
  const csvPath = resolve(__dirname, "asvs_map.csv");
  const content = readFileSync(csvPath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("ASVS mapping CSV is empty");
  }

  const header = parseCsvLine(lines[0]);
  if (header.join(",") !== "Control,Description,Status,EvidencePath") {
    throw new Error("ASVS mapping CSV header is invalid");
  }

  const controls = lines.slice(1).map((line, index) => {
    const [control, description, status, evidencePath] = parseCsvLine(line);

    if (!control || !description || !status) {
      throw new Error(`Row ${index + 2} is missing required values`);
    }

    const normalizedStatus = status.toUpperCase();
    if (!VALID_STATUSES.has(normalizedStatus)) {
      throw new Error(`Row ${index + 2} has invalid status '${status}'`);
    }

    return {
      control,
      description,
      status: normalizedStatus as ControlRecord["status"],
      evidencePath: evidencePath ?? "",
    };
  });

  return controls;
}

function main() {
  const controls = readControls();

  const summary = {
    PASS: 0,
    FAIL: 0,
    NA: 0,
  } as Record<ControlRecord["status"], number>;

  const failingControls: ControlRecord[] = [];
  const invalidNaControls: ControlRecord[] = [];

  for (const control of controls) {
    summary[control.status] += 1;

    if (control.status === "FAIL") {
      failingControls.push(control);
      continue;
    }

    if (control.status === "NA" && !NON_WEB_CONTROLS.has(control.control)) {
      invalidNaControls.push(control);
    }
  }

  console.log("ASVS Control Summary");
  console.log(`  Total: ${controls.length}`);
  console.log(`  PASS : ${summary.PASS}`);
  console.log(`  FAIL : ${summary.FAIL}`);
  console.log(`  NA   : ${summary.NA}`);

  if (invalidNaControls.length > 0) {
    console.error("\nControls marked NA but not designated non-web:");
    for (const control of invalidNaControls) {
      console.error(`  - ${control.control}: ${control.description}`);
    }
  }

  if (failingControls.length > 0) {
    console.error("\nControls marked FAIL:");
    for (const control of failingControls) {
      console.error(`  - ${control.control}: ${control.description}`);
    }
  }

  if (failingControls.length > 0 || invalidNaControls.length > 0) {
    process.exit(1);
  }
}

main();
