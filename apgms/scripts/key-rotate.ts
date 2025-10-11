import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

function createSecret(): string {
  return crypto.randomBytes(32).toString("base64").replace(/=+$/, "");
}

async function main() {
  const newSecret = createSecret();
  const envPath = path.resolve(process.cwd(), ".env");

  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const lines = existing.split(/\r?\n/);
  let updated = false;
  const nextLines = lines
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }
      if (trimmed.startsWith("JWT_SECRET=")) {
        updated = true;
        return `JWT_SECRET=${newSecret}`;
      }
      return line;
    })
    .filter((line, index, arr) => !(line === "" && index === arr.length - 1));

  if (!updated) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`JWT_SECRET=${newSecret}`);
  }

  await fs.writeFile(envPath, `${nextLines.join("\n")}\n`, "utf8");
  console.log("Generated new JWT secret and wrote it to .env");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
