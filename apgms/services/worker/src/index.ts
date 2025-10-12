import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
const client = createClient({ url: redisUrl });

client.on('error', (err) => console.error('Redis error', err));

(async () => {
  await client.connect();
  console.log('Worker connected to Redis');

  // naive polling for a list named "reconcile"
  while (true) {
    const res = await client.blPop('reconcile', 5);
    if (res) {
      const [, payload] = res;
      console.log('Reconcile job:', payload);
      // TODO: call api-gateway or tax-engine here
    }
  }
})();
