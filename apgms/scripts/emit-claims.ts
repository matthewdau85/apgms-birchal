import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const token = process.argv[2];

if (!token) {
  console.error("Usage: pnpm run emit-claims <jwt>");
  process.exitCode = 1;
  process.exit(1);
}

const [, payload] = token.split(".");
if (!payload) {
  console.error("Invalid token");
  process.exitCode = 1;
  process.exit(1);
}

const decodeBase64Url = (value: string) => {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
};

const findRepoRoot = (start: string): string => {
  let current = start;
  while (true) {
    const hasWorkspace = existsSync(path.join(current, "pnpm-workspace.yaml"));
    const hasGit = existsSync(path.join(current, ".git"));
    if (hasWorkspace || hasGit) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return start;
    }
    current = parent;
  }
};

const main = async () => {
  const decoded = decodeBase64Url(payload).toString("utf-8");

  let claims: unknown;
  try {
    claims = JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to parse token payload", error);
    process.exitCode = 1;
    process.exit(1);
  }

  const artifactsDir = path.join(findRepoRoot(process.cwd()), "artifacts");
  await fs.mkdir(artifactsDir, { recursive: true });
  const artifactPath = path.join(artifactsDir, "claims.json");
  await fs.writeFile(artifactPath, JSON.stringify(claims, null, 2) + "\n", "utf-8");

  console.log(`Wrote claims to ${artifactPath}`);
};

main().catch((error) => {
  console.error("Failed to emit claims", error);
  process.exitCode = 1;
  process.exit(1);
});
