import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { loadServiceConfig } from "@apgms/shared";

export function buildRegistriesServer(serviceName = "registries"): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok", service: serviceName }));
  app.get("/registries/entities", async () => ({ entities: [] }));
  return app;
}

async function start() {
  const config = loadServiceConfig("registries", import.meta.url);
  const app = buildRegistriesServer(config.serviceName);
  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info({ address, env: config.env }, "registries service ready");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
