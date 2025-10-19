import fs from "node:fs";
import path from "node:path";

const sbomPath = path.resolve(process.cwd(), process.argv[2] ?? "artifacts/sbom/sbom.json");
const allowlistPath = path.resolve(process.cwd(), "security/allowlist.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  if (!fs.existsSync(sbomPath)) {
    throw new Error(`SBOM not found at ${sbomPath}`);
  }
  if (!fs.existsSync(allowlistPath)) {
    throw new Error(`Allowlist not found at ${allowlistPath}`);
  }

  const sbom = JSON.parse(await fs.promises.readFile(sbomPath, "utf8"));
  assert(Array.isArray(sbom.components), "SBOM missing components array");

  const allowlist = JSON.parse(await fs.promises.readFile(allowlistPath, "utf8"));
  assert(Array.isArray(allowlist.allow), "Allowlist must include an array of allowed component IDs");

  const flagged = [] as string[];
  for (const component of sbom.components) {
    if (component.vulnerabilities && component.vulnerabilities.length > 0) {
      const allowed = component.vulnerabilities.every((v: any) => allowlist.allow.includes(v.id));
      if (!allowed) {
        flagged.push(component.name ?? component.purl ?? "unknown");
      }
    }
  }

  if (flagged.length > 0) {
    console.error(`Found vulnerabilities without allowlist: ${flagged.join(", ")}`);
    process.exit(1);
  }

  console.log(`SBOM check passed for ${sbom.components.length} components`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
