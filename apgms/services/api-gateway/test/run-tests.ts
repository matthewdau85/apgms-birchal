import { resetRegistry, runRegisteredTests } from "./support/vitest";

resetRegistry();

await import("./policy-engine.spec");
await import("./rpt.spec");

await runRegisteredTests();

console.log("All policy engine and RPT tests passed");
