import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      provider: "v8",
      exclude: ["test/setup.ts"],
      thresholds: {
        lines: 0.8,
        functions: 0.8,
        statements: 0.8,
        branches: 0.7,
      },
    },
  },
});
