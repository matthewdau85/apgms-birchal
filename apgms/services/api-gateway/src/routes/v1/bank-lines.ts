import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

type BankLine = {
  id: string;
  orgId: string;
  accountId: string;
  amount: number;
  currency: string;
  occurredAt: string;
  description?: string;
};

const memory: Record<string, BankLine> = {};

export async function bankLinesRoutes(app: FastifyInstance) {
  // Create (idempotent via idempotency plugin)
  app.post('/v1/bank-lines', async (req, reply) => {
    // @ts-ignore
    const orgId: string = (req as any).orgId || 'demo-org';
    const body = (req.body || {}) as Partial<BankLine>;
    const line: BankLine = {
      id: randomUUID(),
      orgId,
      accountId: String(body.accountId ?? 'acct-unknown'),
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? 'AUD'),
      occurredAt: String(body.occurredAt ?? new Date().toISOString()),
      description: body.description
    };
    memory[line.id] = line;
    reply.code(201).send(line);
  });

  // Read
  app.get('/v1/bank-lines/:id', async (req, reply) => {
    const { id } = (req.params as any);
    const found = memory[id];
    if (!found) return reply.code(404).send({ code: 'NOT_FOUND' });
    // @ts-ignore
    const orgId: string = (req as any).orgId || 'demo-org';
    if (found.orgId !== orgId) return reply.code(403).send({ code: 'FORBIDDEN' });
    reply.send(found);
  });

  // List (basic)
  app.get('/v1/bank-lines', async (_req, reply) => {
    reply.send(Object.values(memory));
  });
}
