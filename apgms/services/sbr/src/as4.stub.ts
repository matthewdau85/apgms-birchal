import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "artifacts/sbr/out");
const inDir = path.resolve(process.cwd(), "artifacts/sbr/in");

export async function send(message: Record<string, unknown>) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const id = randomUUID();
  const payload = {
    id,
    sentAt: new Date().toISOString(),
    message,
  };
  await fs.promises.writeFile(
    path.join(outDir, `${id}.json`),
    JSON.stringify(payload, null, 2),
  );
  return { messageId: id };
}

export async function receive() {
  await fs.promises.mkdir(inDir, { recursive: true });
  const files = await fs.promises.readdir(inDir);
  const messages: Array<{ id: string; message: unknown }> = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const id = file.replace(/\.json$/, "");
    const content = await fs.promises.readFile(path.join(inDir, file), "utf8");
    const parsed = JSON.parse(content);
    messages.push({ id, message: parsed });
  }

  return {
    messageIds: messages.map((m) => m.id),
    messages,
  };
}
