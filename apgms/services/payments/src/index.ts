import { fileURLToPath } from "node:url";
import { createQueue, createRedisConnection, loadServiceConfig, queueContracts } from "@apgms/shared";
import { createPaymentsServer, createPaymentsWorker } from "./server";

async function start() {
  const config = loadServiceConfig("payments", import.meta.url);
  const redis = createRedisConnection(config.redisUrl);
  const paymentQueue = await createQueue(queueContracts.paymentLifecycle, redis, { prefix: config.bullQueuePrefix });
  const auditQueue = await createQueue(queueContracts.auditEvent, redis, { prefix: config.bullQueuePrefix });

  await createPaymentsWorker(redis, auditQueue);

  const app = createPaymentsServer({ paymentQueue, auditQueue, serviceName: config.serviceName });
  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info({ address, env: config.env }, "payments service ready");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createPaymentsServer, createPaymentsWorker };
