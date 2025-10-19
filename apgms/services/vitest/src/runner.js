import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runSuites, resetSuites } from "./index.js";

async function collectSpecFiles(entry) {
  const resolved = path.resolve(process.cwd(), entry);
  const stats = await stat(resolved).catch(() => undefined);
  if (!stats) {
    return [];
  }
  if (stats.isDirectory()) {
    const files = await readdir(resolved);
    const collected = [];
    for (const file of files) {
      const child = path.join(resolved, file);
      const childStats = await stat(child);
      if (childStats.isDirectory()) {
        collected.push(...(await collectSpecFiles(child)));
      } else if (child.endsWith(".spec.ts") || child.endsWith(".spec.js")) {
        collected.push(child);
      }
    }
    return collected;
  }
  if (resolved.endsWith(".spec.ts") || resolved.endsWith(".spec.js")) {
    return [resolved];
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ["test"];
  const files = new Set();
  for (const target of targets) {
    const resolved = await collectSpecFiles(target);
    for (const file of resolved) {
      files.add(file);
    }
  }

  if (files.size === 0) {
    console.error("No test files found.");
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    await import(pathToFileURL(file).href);
  }

  const results = await runSuites();
  console.log(`\nTests: ${results.passed} passed, ${results.failed} failed.`);
  resetSuites();
  if (results.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
