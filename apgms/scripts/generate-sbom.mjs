import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const artifactsDir = path.join(repoRoot, "artifacts");
const outputPath = path.join(artifactsDir, "cyclonedx-sbom.json");

function createPurl(name, version) {
  if (!name) {
    return undefined;
  }
  if (name.startsWith("@")) {
    const [scope, pkg] = name.slice(1).split("/");
    if (!scope || !pkg) {
      return undefined;
    }
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(pkg)}@${version}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${version}`;
}

function addComponent(components, name, version) {
  if (!name || !version) {
    return;
  }
  const key = `${name}@${version}`;
  if (components.has(key)) {
    return;
  }
  const purl = createPurl(name, version);
  components.set(key, {
    "bom-ref": purl ?? key,
    type: "library",
    name,
    version,
    ...(purl ? { purl } : {}),
  });
}

function walkDependencies(node, components) {
  if (!node || typeof node !== "object") {
    return;
  }

  if (!node.private && node.name && node.version) {
    addComponent(components, node.name, node.version);
  }

  const moreSections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const section of moreSections) {
    const deps = node[section];
    if (!deps || typeof deps !== "object") continue;
    for (const dep of Object.values(deps)) {
      const name = typeof dep === "object" ? dep.name ?? dep.from ?? dep.specifier ?? dep.alias : undefined;
      const version = typeof dep === "object" ? dep.version : undefined;
      addComponent(components, name, version);
      walkDependencies(dep, components);
    }
  }
}

async function collectComponents() {
  let raw;
  try {
    raw = execSync("pnpm list --json --depth Infinity", { encoding: "utf8" });
  } catch (error) {
    raw = error.stdout?.toString();
    if (!raw) {
      console.error("Failed to execute 'pnpm list --json --depth Infinity'.");
      console.error(error.message ?? error);
      process.exit(1);
    }
  }

  let tree;
  try {
    tree = JSON.parse(raw);
  } catch (error) {
    console.error("Unable to parse dependency tree JSON produced by pnpm.");
    console.error(error);
    process.exit(1);
  }

  const components = new Map();
  const entries = Array.isArray(tree) ? tree : [tree];
  for (const entry of entries) {
    walkDependencies(entry, components);
  }
  return Array.from(components.values());
}

async function main() {
  await mkdir(artifactsDir, { recursive: true });
  const components = await collectComponents();
  let pkg;
  try {
    const pkgRaw = await readFile(path.join(repoRoot, "package.json"), "utf8");
    pkg = JSON.parse(pkgRaw);
  } catch (error) {
    console.error("Failed to read package metadata for SBOM generation.");
    console.error(error);
    process.exit(1);
  }

  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: "application",
        name: pkg.name,
        version: pkg.version,
        "bom-ref": pkg.name,
      },
    },
    components,
  };

  await writeFile(outputPath, JSON.stringify(bom, null, 2));
  console.log(`CycloneDX SBOM written to ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error("Unexpected error while generating SBOM.");
  console.error(error);
  process.exit(1);
});
