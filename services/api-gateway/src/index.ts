import Fastify from 'fastify';
import pino from 'pino';
import { prisma } from '@apgms/shared';

const logger = pino({ level: 'info' });
const app = Fastify({ logger });

app.get('/health', async () => ({ ok: true }));

app.get('/users', async () => {
  const users = await prisma.user.findMany({ take: 10, include: { org: true } });
  return { users };
});

app.get('/bank-lines', async () => {
  return { lines: [] };
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  logger.info(`API listening on :${port}`);
});
