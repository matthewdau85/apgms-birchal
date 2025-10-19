import { spawn } from "node:child_process";

function runMigrateStatus(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["-w", "exec", "prisma", "migrate", "status"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const message = [stdout, stderr].filter(Boolean).join("\n");
        reject(new Error(message || `Command exited with status ${code}`));
      }
    });
  });
}

try {
  const output = await runMigrateStatus();
  if (!/up to date/i.test(output)) {
    console.error("❌ Prisma schema drift detected.");
    console.error(output.trim());
    process.exit(1);
  }
  console.log("✅ Prisma migrations are up to date.");
  console.log(output.trim());
} catch (error) {
  console.error("❌ Failed to verify Prisma migrations.");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
}
