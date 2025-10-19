import { runSuites } from "./vitest-mock";

await import("./auth.spec");
await import("./org-scope.spec");

const success = await runSuites();

if (!success) {
  process.exitCode = 1;
}
