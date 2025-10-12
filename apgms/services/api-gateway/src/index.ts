import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '../../../shared/src/db';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.addHook('onRequest', async (_request, reply) => {
  reply.type('application/json');
});

app.get('/health', async () => ({ ok: true }));

app.get('/bank-lines', async () => {
  const rows = await prisma.bankLine.findMany({ orderBy: { createdAt: 'desc' } });
  return rows;
});

app.post('/bank-lines', async (request, reply) => {
  const body: any = request.body ?? {};
  const row = await prisma.bankLine.create({
    data: {
      amount: body.amount ?? 0,
      description: body.description ?? 'n/a',
      txDate: body.txDate ? new Date(body.txDate) : new Date(),
    },
  });
  reply.code(201);
  return row;
});

const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

const start = async () => {
  try {
    await app.listen({ port, host });
    app.log.info(`api-gateway listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const closeWithGrace = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'closing fastify server');
  try {
    await app.close();
  } catch (err) {
    app.log.error(err);
  } finally {
    process.exit(0);
  }
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    void closeWithGrace(signal);
  });
});

start();
