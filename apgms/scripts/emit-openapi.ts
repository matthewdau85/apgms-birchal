import fs from 'node:fs';
import path from 'node:path';
import fastify from 'fastify';
import openapiPlugin from '../services/api-gateway/src/plugins/openapi';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { reportsRoutes } from '../services/api-gateway/src/routes/v1/reports';

async function main() {
  const app = fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(openapiPlugin);
  await app.register(reportsRoutes);

  await app.ready();
  const res = await app.inject({ method: 'GET', url: '/openapi.json' });
  if (res.statusCode !== 200) throw new Error('Failed to fetch /openapi.json: ' + res.statusCode);
  const spec = res.json();
  const out = path.resolve(process.cwd(), 'apgms/openapi.json');
  fs.writeFileSync(out, JSON.stringify(spec, null, 2), 'utf8');
  await app.close();
  console.log('OpenAPI written to', out);
}

main().catch((e) => { console.error(e); process.exit(1); });
