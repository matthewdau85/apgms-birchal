import { fileURLToPath } from "node:url";
import { createQueue, createRedisConnection, loadServiceConfig, queueContracts } from "@apgms/shared";
import { createReconServer, startReconciliationWorker } from "./server";

async function start() {
  const config = loadServiceConfig("recon", import.meta.url);
  const redis = createRedisConnection(config.redisUrl);
  const auditQueue = await createQueue(queueContracts.auditEvent, redis, { prefix: config.bullQueuePrefix });
  const paymentQueue = await createQueue(queueContracts.paymentLifecycle, redis, { prefix: config.bullQueuePrefix });

  await startReconciliationWorker(redis, { auditQueue, paymentQueue });

  const app = createReconServer(config.serviceName);
  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info({ address, env: config.env }, "recon service ready");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createReconServer, startReconciliationWorker };
