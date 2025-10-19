import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const workspaceManifests = [
  "package.json",
  "services/api-gateway/package.json",
  "services/payments/package.json",
  "services/sbr/package.json",
  "shared/package.json",
  "worker/package.json",
];

const components: Array<{ name: string; version: string; type: string }> = [];

for (const manifestPath of workspaceManifests) {
  const fullPath = path.resolve(process.cwd(), manifestPath);
  if (!fs.existsSync(fullPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(fullPath, "utf8")) as PackageManifest;
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith("workspace:")) continue;
    if (!components.find((component) => component.name === name)) {
      components.push({ name, version, type: "library" });
    }
  }
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ name: "apgms-sbom-script" }],
  },
  components,
};

async function main() {
  const outputPath = path.resolve(process.cwd(), "artifacts/sbom/sbom.json");
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, `${JSON.stringify(sbom, null, 2)}\n`);
  console.log(`SBOM written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
