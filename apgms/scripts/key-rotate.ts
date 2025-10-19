import { randomBytes } from "node:crypto";

type OutputFormat = "base64url" | "hex";

const DEFAULT_BYTES = 64;
const DEFAULT_FORMAT: OutputFormat = "base64url";

const args = process.argv.slice(2);

const usage = `Usage: pnpm tsx scripts/key-rotate.ts [--bytes <size>] [--format base64url|hex]\n\nExamples:\n  pnpm tsx scripts/key-rotate.ts\n  pnpm tsx scripts/key-rotate.ts --bytes 48 --format hex`;

let bytes = DEFAULT_BYTES;
let format: OutputFormat = DEFAULT_FORMAT;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg) continue;

  if (arg === "--help" || arg === "-h") {
    console.log(usage);
    process.exit(0);
  }

  if (arg === "--bytes" && typeof args[i + 1] !== "undefined") {
    const next = Number.parseInt(args[i + 1]!, 10);
    if (!Number.isFinite(next) || next <= 0) {
      console.error(`Invalid value for --bytes: ${args[i + 1]}`);
      console.error(usage);
      process.exit(1);
    }
    bytes = next;
    i += 1;
    continue;
  }

  if (arg === "--format" && typeof args[i + 1] !== "undefined") {
    const next = args[i + 1] as OutputFormat;
    if (next !== "base64url" && next !== "hex") {
      console.error(`Invalid value for --format: ${args[i + 1]}`);
      console.error(usage);
      process.exit(1);
    }
    format = next;
    i += 1;
    continue;
  }

  console.error(`Unknown argument: ${arg}`);
  console.error(usage);
  process.exit(1);
}

const secret = randomBytes(bytes).toString(format);

console.error(`Generated ${bytes}-byte secret (${format}). Paste into your JWT_SECRET.`);
process.stdout.write(`${secret}\n`);
