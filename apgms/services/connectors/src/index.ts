import { fileURLToPath } from "node:url";
import { createQueue, createRedisConnection, loadServiceConfig, queueContracts } from "@apgms/shared";
import { createConnectorsServer } from "./server";

async function start() {
  const config = loadServiceConfig("connectors", import.meta.url);
  const redis = createRedisConnection(config.redisUrl);
  const bankFeedQueue = await createQueue(queueContracts.bankFeedIngest, redis, { prefix: config.bullQueuePrefix });
  const auditQueue = await createQueue(queueContracts.auditEvent, redis, { prefix: config.bullQueuePrefix });

  const app = createConnectorsServer({
    bankFeedQueue,
    auditQueue,
    serviceName: config.serviceName,
  });

  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info({ address, env: config.env }, "connectors service ready");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createConnectorsServer };
export type { ConnectorsDependencies } from "./server";
