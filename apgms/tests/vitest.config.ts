import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      { find: /^@apgms\/shared$/, replacement: path.resolve(__dirname, "../shared/src") },
      { find: /^@apgms\/shared\/(.*)$/, replacement: path.resolve(__dirname, "../shared/src/$1") },
    ],
  },
  test: {
    include: ["property/**/*.spec.ts"],
    globals: true,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      include: ["../shared/src/policy-engine.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 0.85,
        branches: 0.75,
        functions: 0.85,
        lines: 0.85,
      },
    },
  },
});
