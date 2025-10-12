import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs", "dsp-osf");
mkdirSync(docsDir, { recursive: true });

const repository = process.env.GITHUB_REPOSITORY ?? "birchal/apgms-birchal";
const releaseRef = process.env.GITHUB_REF_NAME ?? process.env.RELEASE_TAG ?? "local";
const refreshedAt = new Date().toISOString();

const workflowUrl = (workflow: string, query?: string) => {
  const q = query ? `?${query}` : "";
  return `https://github.com/${repository}/actions/workflows/${workflow}${q}`;
};

type ControlRow = {
  control: string;
  osfSections: string[];
  implementation: string[];
  artifact: { label: string; url: string };
};

const rows: ControlRow[] = [
  {
    control: "Authentication",
    osfSections: ["OSF 2.2 - Identity & Access Control"],
    implementation: [
      "API Gateway enforces bearer token authentication for every request to financial data endpoints.",
    ],
    artifact: {
      label: "CI build & test logs",
      url: workflowUrl("ci.yml", "query=event%3Arelease"),
    },
  },
  {
    control: "Logging",
    osfSections: ["OSF 3.3 - Security Monitoring"],
    implementation: [
      "Fastify services emit structured request and application logs to support incident investigations.",
    ],
    artifact: {
      label: "CI build & test logs",
      url: workflowUrl("ci.yml", "query=event%3Arelease"),
    },
  },
  {
    control: "Software Bill of Materials (SBOM)",
    osfSections: ["OSF 4.2 - Software Supply Chain Integrity"],
    implementation: [
      "Security workflow publishes a CycloneDX SBOM for the pnpm workspace on every push.",
    ],
    artifact: {
      label: "Security workflow artifacts",
      url: workflowUrl("security.yml", "query=event%3Arelease"),
    },
  },
  {
    control: "Automated Scans",
    osfSections: ["OSF 4.3 - Vulnerability Management"],
    implementation: [
      "Security workflow runs dependency audits and retains reports for traceability.",
    ],
    artifact: {
      label: "Security workflow artifacts",
      url: workflowUrl("security.yml", "query=event%3Arelease"),
    },
  },
];

const header = `# DSP OSF control matrix\n\n` +
  `*Last refreshed: ${refreshedAt} (source: ${releaseRef})*\n\n` +
  "| Control | OSF section(s) | Implementation evidence | CI artifact |\n" +
  "| --- | --- | --- | --- |\n";

const body = rows
  .map((row) => {
    const osfCell = row.osfSections.join("<br>");
    const implementationCell = row.implementation.join("<br>");
    const artifactCell = `[${row.artifact.label}](${row.artifact.url})`;
    return `| ${row.control} | ${osfCell} | ${implementationCell} | ${artifactCell} |`;
  })
  .join("\n");

const content = `${header}${body}\n`;

writeFileSync(path.join(docsDir, "matrix.md"), content);
