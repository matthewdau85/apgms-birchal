import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    watch: false,
    environment: "node",
    testTimeout: 20000,
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
