import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const globs = [
  "services/api-gateway/src",
  "services/api-gateway/test",
  "scripts",
];

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const offenders: Array<{ file: string; line: number; snippet: string }> = [];

  for (const pattern of globs) {
    const absolute = path.join(projectRoot, pattern);
    try {
      const stats = await stat(absolute);
      if (!stats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    const files = await collectFiles(absolute);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\b(?:describe|test|it)\.only\s*\(/.test(line)) {
          offenders.push({ file, line: index + 1, snippet: line.trim() });
        }
      });
    }
  }

  if (offenders.length > 0) {
    console.error("❌ Found focused tests. Remove .only before committing.");
    for (const offender of offenders) {
      console.error(` - ${path.relative(projectRoot, offender.file)}:${offender.line} ${offender.snippet}`);
    }
    process.exit(1);
  }

  console.log("✅ Lint checks passed (no focused tests detected).");
}

main().catch((error) => {
  console.error("❌ Lint script failed.");
  console.error(error);
  process.exit(1);
});
