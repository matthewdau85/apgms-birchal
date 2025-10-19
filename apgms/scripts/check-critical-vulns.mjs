import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const allowlistPath = path.join(repoRoot, "security", "sca-allowlist.json");

async function loadAllowlist() {
  if (!existsSync(allowlistPath)) {
    return { advisoryIds: [], cves: [] };
  }
  try {
    const raw = await readFile(allowlistPath, "utf8");
    const data = JSON.parse(raw);
    return {
      advisoryIds: Array.isArray(data.advisoryIds) ? data.advisoryIds.map(String) : [],
      cves: Array.isArray(data.cves) ? data.cves.map((c) => String(c).toUpperCase()) : [],
    };
  } catch (error) {
    console.error(`Failed to read allowlist at ${path.relative(repoRoot, allowlistPath)}.`);
    console.error(error);
    process.exit(1);
  }
}

function runAudit() {
  let output;
  try {
    output = execSync("pnpm audit --prod --json", { encoding: "utf8" });
  } catch (error) {
    output = error.stdout?.toString();
    if (!output) {
      console.error("'pnpm audit --prod --json' failed to execute.");
      console.error(error.message ?? error);
      process.exit(1);
    }
  }

  let data;
  try {
    data = JSON.parse(output);
  } catch (error) {
    console.error("Unable to parse JSON output from pnpm audit.");
    console.error(error);
    process.exit(1);
  }

  if (data?.error) {
    console.error("pnpm audit returned an error response:");
    console.error(`${data.error.code ?? ""} ${data.error.message ?? ""}`.trim());
    process.exit(1);
  }

  return data;
}

function extractAdvisories(auditJson) {
  const advisories = [];
  if (auditJson?.advisories && typeof auditJson.advisories === "object") {
    for (const advisory of Object.values(auditJson.advisories)) {
      advisories.push(advisory);
    }
  }

  if (auditJson?.vulnerabilities && typeof auditJson.vulnerabilities === "object") {
    for (const vuln of Object.values(auditJson.vulnerabilities)) {
      if (!vuln) continue;
      if (Array.isArray(vuln.via)) {
        for (const via of vuln.via) {
          if (via && typeof via === "object" && (via.severity || via.title)) {
            advisories.push({
              id: via.source || via.id,
              module_name: vuln.name || via.name || vuln.module_name,
              severity: via.severity,
              url: via.url,
              cves: via.cves,
              title: via.title,
            });
          }
        }
      }
      if (Array.isArray(vuln.advisories)) {
        advisories.push(...vuln.advisories);
      }
    }
  }
  return advisories;
}

function advisoryIdentifiers(advisory) {
  const identifiers = [];
  if (!advisory || typeof advisory !== "object") {
    return identifiers;
  }
  if (advisory.id != null) identifiers.push(String(advisory.id));
  if (advisory.github_advisory_id) identifiers.push(String(advisory.github_advisory_id));
  if (advisory.ghsaId) identifiers.push(String(advisory.ghsaId));
  if (advisory.url) identifiers.push(String(advisory.url));
  if (Array.isArray(advisory.cves)) {
    for (const cve of advisory.cves) {
      identifiers.push(String(cve).toUpperCase());
    }
  }
  return identifiers;
}

async function main() {
  const allowlist = await loadAllowlist();
  const allowIds = new Set(allowlist.advisoryIds.map(String));
  const allowCves = new Set(allowlist.cves.map((c) => c.toUpperCase()));

  const auditJson = runAudit();
  const advisories = extractAdvisories(auditJson);

  const unexpected = [];
  for (const advisory of advisories) {
    const severity = String(advisory?.severity ?? "").toLowerCase();
    if (severity !== "critical") continue;
    const identifiers = advisoryIdentifiers(advisory);
    const allowed = identifiers.some((id) => allowIds.has(String(id))) ||
      identifiers.some((id) => allowCves.has(String(id).toUpperCase()));
    if (!allowed) {
      unexpected.push({
        id: identifiers[0] ?? "unknown",
        module: advisory.module_name ?? advisory.name ?? "unknown",
        title: advisory.title ?? "", 
        url: advisory.url ?? "",
      });
    }
  }

  if (unexpected.length > 0) {
    console.error("Critical vulnerabilities detected that are not on the allowlist:");
    for (const vuln of unexpected) {
      console.error(`- ${vuln.module} (${vuln.id}) ${vuln.title}`);
      if (vuln.url) {
        console.error(`  ${vuln.url}`);
      }
    }
    console.error(`Update ${path.relative(repoRoot, allowlistPath)} if these findings are acceptable.`);
    process.exit(1);
  }

  console.log("No new critical vulnerabilities detected by pnpm audit.");
}

main().catch((error) => {
  console.error("Unexpected failure while evaluating audit results.");
  console.error(error);
  process.exit(1);
});
