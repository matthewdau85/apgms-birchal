#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs", "dsp-osf");
const matrixPath = path.join(docsDir, "matrix.md");

const githubServer = process.env.GITHUB_SERVER_URL || "https://github.com";
const githubRepository = process.env.GITHUB_REPOSITORY || "apgms/apgms-birchal";
const workflowBaseUrl = `${githubServer}/${githubRepository}/actions/workflows`;

const workflowLink = (file) => `${workflowBaseUrl}/${file}`;

const controls = [
  {
    id: "authentication",
    control: "Authentication & access management",
    osfSection: "OSF 4.2 – Access management",
    summary: [
      "Fastify API gateway centralises ingress and loads environment managed secrets before registering routes ([API gateway service](../../services/api-gateway/src/index.ts)).",
      "Shared Prisma client encapsulates database identity for service-to-service operations ([Shared Prisma client](../../shared/src/db.ts)).",
    ],
    evidence: [
      {
        label: "CI build & test",
        url: workflowLink("ci.yml"),
        description: "Builds and tests all workspaces on each push to guard gateway integrations.",
      },
      {
        label: "E2E smoke tests",
        url: workflowLink("e2e.yml"),
        description: "Playwright workflow verifies authentication pathways when triggered before release.",
      },
    ],
  },
  {
    id: "logging",
    control: "Logging & audit trails",
    osfSection: "OSF 5.4 – Security monitoring & logging",
    summary: [
      "Fastify logger is enabled for the gateway, recording structured operational events ([API gateway logger configuration](../../services/api-gateway/src/index.ts)).",
      "Error handling captures failures with contextual metadata for investigation ([Bank line ingestion handler](../../services/api-gateway/src/index.ts)).",
    ],
    evidence: [
      {
        label: "CI build & test",
        url: workflowLink("ci.yml"),
        description: "Lints and tests services ensuring logging hooks compile and execute.",
      },
    ],
  },
  {
    id: "sbom",
    control: "SBOM & supply chain governance",
    osfSection: "OSF 6.1 – Software integrity & provenance",
    summary: [
      "Workspace lockfiles are under version control for deterministic builds ([Root pnpm lockfile](../../pnpm-lock.yaml)).",
      "Release automation refreshes this matrix to surface dependency attestations ([Release matrix workflow](../../.github/workflows/release-matrix.yml)).",
    ],
    evidence: [
      {
        label: "Release matrix workflow",
        url: workflowLink("release-matrix.yml"),
        description: "Runs on every published release to regenerate documentation and attach evidence.",
      },
    ],
  },
  {
    id: "scans",
    control: "Vulnerability scanning",
    osfSection: "OSF 7.2 – Vulnerability management",
    summary: [
      "Dedicated security workflow runs on every push to execute scanning steps ([Security workflow](../../.github/workflows/security.yml)).",
    ],
    evidence: [
      {
        label: "Security scans",
        url: workflowLink("security.yml"),
        description: "Automated scanning pipeline triggered on each push, retaining execution artefacts.",
      },
    ],
  },
];

const renderSummary = (lines) => lines.map((line) => `- ${line}`).join("\n");

const renderEvidence = (items) =>
  items.map((item) => `- [${item.label}](${item.url}) – ${item.description}`).join("\n");

const tableRows = controls
  .map((control) => {
    const summary = control.summary.map((line) => line.replace(/\n/g, " ")).join("<br />");
    const evidence = control.evidence
      .map((item) => `[${item.label}](${item.url})`)
      .join("<br />");
    return `| ${control.control} | ${control.osfSection} | ${summary} | ${evidence} |`;
  })
  .join("\n");

const detailSections = controls
  .map(
    (control) =>
      `### ${control.control}\n\n**OSF focus:** ${control.osfSection}.\n\n#### Implementation highlights\n\n${renderSummary(
        control.summary,
      )}\n\n#### Evidence retained\n\n${renderEvidence(control.evidence)}\n`,
  )
  .join("\n");

const content = `# DSP OSF control coverage matrix

> Alignment of implemented controls to the Digital Service Provider Operational Security Framework as published via the Federal Register of Legislation.
>
> _This file is auto-generated; edit **scripts/refresh-osf-matrix.js** instead._

| Control | OSF section | Implementation summary | Evidence |
| --- | --- | --- | --- |
${tableRows}

## Detailed control notes

${detailSections}`;

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(matrixPath, `${content.trim()}\n`, "utf8");

console.log(`Refreshed OSF matrix at ${path.relative(process.cwd(), matrixPath)}`);
