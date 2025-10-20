import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { ConsoleLogger, type Logger } from './logger.js';
import { PaymentsMetrics } from './metrics.js';
import { Gate } from './gate.js';
import { InMemoryRemittanceQueue } from './queue.js';
import { TransferStore } from './store.js';
import type { CreateRemittanceInput, Remittance } from './types.js';

export interface CreatePaymentsServerOptions {
  readonly store?: TransferStore;
  readonly queue?: InMemoryRemittanceQueue;
  readonly gate?: Gate;
  readonly metrics?: PaymentsMetrics;
  readonly logger?: Logger;
}

export interface PaymentsServer {
  readonly app: FastifyInstance;
  readonly store: TransferStore;
  readonly queue: InMemoryRemittanceQueue;
  readonly gate: Gate;
  readonly metrics: PaymentsMetrics;
}

export function createPaymentsServer(options: CreatePaymentsServerOptions = {}): PaymentsServer {
  const logger = options.logger ?? new ConsoleLogger();
  const gate = options.gate ?? new Gate('OPEN');
  const store = options.store ?? new TransferStore();
  const queue = options.queue ?? new InMemoryRemittanceQueue(gate);
  const metrics = options.metrics ?? new PaymentsMetrics();

  const app = Fastify();
  app.post<{ Body: CreateRemittanceInput }>('/remit', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id']?.toString() ?? `req-${randomUUID()}`;
    const remittance = await store.createRemittance({
      amount: request.body.amount,
      currency: request.body.currency,
      method: request.body.method,
      beneficiary: request.body.beneficiary,
      correlationId,
    });

    queue.enqueue(remittance.id);
    metrics.remittanceEnqueued.inc();

    logger.info(
      { correlationId, remittanceId: remittance.id, status: remittance.status },
      'remittance enqueued',
    );

    await reply.code(201).send(remittance satisfies Remittance);
  });

  app.get<{ Params: { id: string } }>('/remit/:id', async (request, reply) => {
    const remittance = await store.getRemittance(request.params.id);
    if (!remittance) {
      return reply.code(404).send({ message: 'Not Found' });
    }

    return reply.send(remittance satisfies Remittance);
  });

  app.get('/metrics', async (_request, reply) => {
    return reply.type('text/plain').send(metrics.metrics());
  });

  return { app, store, queue, gate, metrics };
}
