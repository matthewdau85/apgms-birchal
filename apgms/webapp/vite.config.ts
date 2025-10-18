import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 5173),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
