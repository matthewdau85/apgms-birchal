import { run } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

await import("./bank-lines.spec.ts");

const success = await run();

if (!success) {
  process.exitCode = 1;
}
