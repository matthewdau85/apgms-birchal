import { runRegisteredTests } from "./vitest-shim";

await import("./validation.test.ts");

const { failed } = await runRegisteredTests();

if (failed > 0) {
  process.exitCode = 1;
}
