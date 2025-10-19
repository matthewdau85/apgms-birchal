import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  enqueueRemittance,
  getGateState,
  PaytoAgreementInput,
  PaytoRemittanceRequest,
} from '../../../../shared/src/payto.js';
import { createAgreement, getAgreement, remit } from '../adapters/payto.mock.js';

const ADMIN_HEADER = 'x-admin-token';
export const DEFAULT_ADMIN_TOKEN = 'letmein';

const agreementSchema = z.object({
  agreementId: z.string().uuid().optional(),
  payerId: z.string().min(1),
  payeeId: z.string().min(1),
  limit: z.number().positive(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const remittanceSchema = z.object({
  remitId: z.string().uuid().optional(),
  agreementId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

type AgreementBody = z.infer<typeof agreementSchema>;
type RemittanceBody = z.infer<typeof remittanceSchema>;

export async function registerPaytoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/payto/agreements', async (request, reply) => {
    if (!isAdmin(request)) {
      return reply.code(403).send({ error: 'ADMIN_REQUIRED' });
    }

    const parsed = agreementSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }

    const agreement = createAgreement(parsed.data as PaytoAgreementInput);
    return reply.code(201).send({ agreement });
  });

  app.post('/payto/remit', async (request, reply) => {
    if (!isAdmin(request)) {
      return reply.code(403).send({ error: 'ADMIN_REQUIRED' });
    }

    const parsed = remittanceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }

    const gateState = getGateState();
    const remitRequest = parsed.data as PaytoRemittanceRequest;

    if (!getAgreement(remitRequest.agreementId)) {
      return reply.code(404).send({ error: 'AGREEMENT_NOT_FOUND' });
    }

    if (gateState === 'OPEN') {
      try {
        const remittance = remit(remitRequest);
        return reply.code(202).send({ status: 'processed', remittance });
      } catch (error) {
        return reply.code(500).send({ error: 'REMIT_FAILED', message: (error as Error).message });
      }
    }

    const queued = enqueueRemittance(remitRequest);
    return reply.code(202).send({ status: 'queued', gate: gateState, remittance: queued });
  });
}

function isAdmin(request: FastifyRequest): boolean {
  const token = request.headers[ADMIN_HEADER] as string | undefined;
  const expected = process.env.PAYMENTS_ADMIN_TOKEN ?? DEFAULT_ADMIN_TOKEN;
  return token === expected;
}

export async function buildPaymentsServer(): Promise<FastifyInstance> {
  const { default: Fastify } = await import('fastify');
  const app = Fastify();
  await registerPaytoRoutes(app);
  return app;
}

export type PaytoAgreementResponse = AgreementBody;
export type PaytoRemittanceResponse = RemittanceBody;
