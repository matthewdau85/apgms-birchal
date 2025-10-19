process.env.OTEL_ENABLED = process.env.OTEL_ENABLED ?? "true";
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.USE_IN_MEMORY_DB = process.env.USE_IN_MEMORY_DB ?? "true";

import Module from "node:module";
import path from "node:path";

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === "@apgms/shared") {
    return path.resolve(process.cwd(), "shared/src/index.ts");
  }
  if (request.startsWith("@apgms/shared/")) {
    const target = request.replace("@apgms/shared/", "");
    return path.resolve(process.cwd(), "shared/src", `${target}.ts`);
  }
  if (request === "@apgms/payments") {
    return path.resolve(process.cwd(), "services/payments/src/index.ts");
  }
  if (request.startsWith("@apgms/payments/")) {
    const target = request.replace("@apgms/payments/", "");
    return path.resolve(process.cwd(), "services/payments/src", `${target}.ts`);
  }
  if (request === "@apgms/sbr") {
    return path.resolve(process.cwd(), "services/sbr/src/index.ts");
  }
  if (request.startsWith("@apgms/sbr/")) {
    const target = request.replace("@apgms/sbr/", "");
    return path.resolve(process.cwd(), "services/sbr/src", `${target}.ts`);
  }
  return originalResolve.call(Module, request, parent, isMain, options);
};

async function main() {
  const { buildApp } = await import("../services/api-gateway/src/app");
  const app = await buildApp();
  await app.inject({ method: "GET", url: "/healthz" });
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
