import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    root: __dirname,
    deps: {
      inline: [/pino/],
    },
  },
});
