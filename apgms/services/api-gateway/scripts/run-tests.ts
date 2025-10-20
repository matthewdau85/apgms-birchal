import { spawnSync } from "node:child_process";

const extraArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const normalizedArgs = extraArgs.map((arg) =>
  arg === "--coverage" ? "--experimental-test-coverage" : arg,
);
const nodeArgs = ["--loader", "tsx", "--test", "--test-reporter=spec", ...normalizedArgs];

const result = spawnSync(process.execPath, nodeArgs, { stdio: "inherit" });

if (typeof result.status === "number") {
  process.exitCode = result.status;
} else if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
}
