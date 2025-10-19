import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildApp } from "../../services/api-gateway/src/app.ts";
import type { InstrumentedFastifyInstance, PrismaAdapter } from "../../services/api-gateway/src/app.ts";

const setupModule = await import("../../scripts/test-setup.ts");
const setupFn =
  typeof setupModule.default === "function"
    ? setupModule.default
    : setupModule.default.default;

await setupFn();

function loadSpec() {
  const specPath = fileURLToPath(new URL("../../docs/openapi.json", import.meta.url));
  return JSON.parse(readFileSync(specPath, "utf-8"));
}

test("OpenAPI spec matches runtime routes", async () => {
  const prisma = {
    user: { findMany: async () => [] },
    bankLine: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => ({}),
    },
  } as unknown as PrismaAdapter;

  const app = (await buildApp(prisma, { logger: false })) as InstrumentedFastifyInstance;
  await app.ready();

  const spec = loadSpec();

  const specPaths = new Map<string, Set<string>>();
  for (const [url, methods] of Object.entries(spec.paths ?? {})) {
    const methodSet = new Set<string>();
    for (const method of Object.keys(methods)) {
      methodSet.add(method.toUpperCase());
    }
    specPaths.set(url, methodSet);
  }

  const runtimePaths = new Map<string, Map<string, boolean>>();
  for (const route of app.routeRegistry) {
    const method = route.method.toUpperCase();
    if (method === "HEAD" || method === "OPTIONS" || route.url === "*") {
      continue;
    }
    if (!runtimePaths.has(route.url)) {
      runtimePaths.set(route.url, new Map());
    }
    runtimePaths.get(route.url)!.set(method, route.requiresAuth);
  }

  for (const [url, methods] of runtimePaths) {
    assert.equal(specPaths.has(url), true, `Spec missing path ${url}`);
    const specMethods = specPaths.get(url)!;
    for (const [method, requiresAuth] of methods) {
      assert.equal(specMethods.has(method), true, `Spec missing method ${method} for ${url}`);
      const specMethod = spec.paths[url][method.toLowerCase()];
      if (requiresAuth) {
        assert.ok(specMethod.security, `${method} ${url} should declare security`);
        const requirement = JSON.stringify(specMethod.security);
        assert.ok(requirement.includes("orgAuth"));
      } else if (specMethod.security) {
        const hasOrgAuth = specMethod.security.some((entry: Record<string, unknown>) =>
          Object.prototype.hasOwnProperty.call(entry, "orgAuth")
        );
        assert.equal(hasOrgAuth, false, `${method} ${url} should not require orgAuth`);
      }
    }
  }

  for (const [url, methods] of specPaths) {
    assert.equal(runtimePaths.has(url), true, `Runtime missing path ${url}`);
    const runtimeMethods = runtimePaths.get(url)!;
    for (const method of methods) {
      if (method === "HEAD") {
        continue;
      }
      assert.equal(runtimeMethods.has(method), true, `Runtime missing method ${method} for ${url}`);
    }
  }

  await app.close();
});
