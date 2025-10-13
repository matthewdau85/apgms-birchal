import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Frequency = "weekly" | "fortnightly" | "monthly";

interface CliOptions {
  effectiveFrom: string;
  source: string;
  url?: string;
  digest?: string;
}

export interface ThresholdRow {
  lower: number;
  upper: number | null;
  rate: number;
  constant: number;
}

export interface PiecewiseFormula {
  lower: number;
  upper: number | null;
  type: "linear";
  slope: number;
  intercept: number;
  expression: string;
  rounding: "nearest-dollar";
}

export interface PaygwPack {
  meta: {
    frequency: Frequency;
    effectiveFrom: string;
    source: string;
    url?: string;
    digest?: string;
  };
  thresholdRows: ThresholdRow[];
  piecewise: PiecewiseFormula[];
}

function parseArgs(argv: string[]): { options: CliOptions; files: string[] } {
  const options: Partial<CliOptions> = {};
  const files: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      files.push(arg);
      continue;
    }

    const [key, valueFromArg] = arg.split("=", 2);
    const optionName = key.slice(2);
    let value = valueFromArg;

    if (value === undefined) {
      i += 1;
      value = argv[i];
    }

    if (!value) {
      throw new Error(`Missing value for --${optionName}`);
    }

    if (optionName === "effective-from") {
      options.effectiveFrom = value;
    } else if (optionName === "source") {
      options.source = value;
    } else if (optionName === "url") {
      options.url = value;
    } else if (optionName === "digest") {
      options.digest = value;
    } else {
      throw new Error(`Unknown option: --${optionName}`);
    }
  }

  if (!options.effectiveFrom) {
    throw new Error("--effective-from is required");
  }

  if (!options.source) {
    throw new Error("--source is required");
  }

  return { options: options as CliOptions, files };
}

export function parseThresholdRows(csvPath: string): ThresholdRow[] {
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length === 0) {
    throw new Error(`No data rows found in ${csvPath}`);
  }

  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const lowerIdx = header.indexOf("lower");
  const upperIdx = header.indexOf("upper");
  const rateIdx = header.indexOf("rate");
  const constantIdx = header.indexOf("constant");

  if (lowerIdx === -1 || upperIdx === -1 || rateIdx === -1 || constantIdx === -1) {
    throw new Error(
      `Expected CSV ${csvPath} to contain columns lower,upper,rate,constant`
    );
  }

  const rows: ThresholdRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== header.length) {
      throw new Error(`Row ${i + 1} in ${csvPath} has ${cells.length} cells, expected ${header.length}`);
    }

    const lowerRaw = cells[lowerIdx];
    const upperRaw = cells[upperIdx];
    const rateRaw = cells[rateIdx];
    const constantRaw = cells[constantIdx];

    const lower = Number(lowerRaw);
    const upper = upperRaw === "" ? null : Number(upperRaw);
    const rate = Number(rateRaw);
    const constant = Number(constantRaw);

    if (Number.isNaN(lower) || Number.isNaN(rate) || Number.isNaN(constant)) {
      throw new Error(`Row ${i + 1} in ${csvPath} contains non-numeric data`);
    }

    if (upperRaw !== "" && Number.isNaN(upper)) {
      throw new Error(`Row ${i + 1} in ${csvPath} has invalid upper bound`);
    }

    rows.push({ lower, upper, rate, constant });
  }

  rows.sort((a, b) => a.lower - b.lower);
  return rows;
}

export function buildPiecewise(rows: ThresholdRow[]): PiecewiseFormula[] {
  return rows.map((row) => {
    const intercept = -row.constant;
    const constantPart =
      row.constant === 0
        ? ""
        : row.constant > 0
        ? ` - ${row.constant}`
        : ` + ${Math.abs(row.constant)}`;
    const expression = `round(amount * ${row.rate}${constantPart})`;

    return {
      lower: row.lower,
      upper: row.upper,
      type: "linear" as const,
      slope: row.rate,
      intercept,
      expression,
      rounding: "nearest-dollar" as const,
    };
  });
}

export function createPack(
  frequency: Frequency,
  rows: ThresholdRow[],
  meta: CliOptions
): PaygwPack {
  return {
    meta: {
      frequency,
      effectiveFrom: meta.effectiveFrom,
      source: meta.source,
      url: meta.url,
      digest: meta.digest,
    },
    thresholdRows: rows,
    piecewise: buildPiecewise(rows),
  };
}

export function savePack(pack: PaygwPack, repoRoot: string): string {
  const outputDir = path.join(repoRoot, "rules", "paygw");
  mkdirSync(outputDir, { recursive: true });
  const filename = `${pack.meta.effectiveFrom}_${pack.meta.frequency}.json`;
  const filepath = path.join(outputDir, filename);
  writeFileSync(filepath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return filepath;
}

async function runCli(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { options, files } = parseArgs(process.argv.slice(2));

  const frequencies: Frequency[] = ["weekly", "fortnightly", "monthly"];
  if (files.length !== frequencies.length) {
    throw new Error(
      `Expected ${frequencies.length} CSV files (weekly fortnightly monthly), received ${files.length}`
    );
  }

  files.forEach((file, index) => {
    const csvPath = path.resolve(process.cwd(), file);
    const rows = parseThresholdRows(csvPath);
    const pack = createPack(frequencies[index], rows, options);
    const outputPath = savePack(pack, repoRoot);
    console.log(`Wrote ${outputPath}`);
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
