import { fileURLToPath } from "node:url";
import { createQueue, createRedisConnection, loadServiceConfig, queueContracts } from "@apgms/shared";
import { createAuditServer, createAuditWorker } from "./server";

async function start() {
  const config = loadServiceConfig("audit", import.meta.url);
  const redis = createRedisConnection(config.redisUrl);
  const auditQueue = await createQueue(queueContracts.auditEvent, redis, { prefix: config.bullQueuePrefix });

  const app = createAuditServer({ auditQueue, serviceName: config.serviceName });
  await createAuditWorker(redis);

  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info({ address, env: config.env }, "audit service ready");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createAuditServer, createAuditWorker };
export type { AuditDependencies } from "./server";
