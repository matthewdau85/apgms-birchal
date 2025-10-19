import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TaxRatesConfig } from '../config/tax-rates.js';
import { draftBas, type BasDraftInput } from '../lib/bas.js';
import { TaxCode } from '../lib/codes.js';

const cashLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  amountCents: z.number().int(),
  taxCode: z.nativeEnum(TaxCode),
  direction: z.union([z.literal('sale'), z.literal('purchase')]),
  bookingDate: z.string()
});

const payrollSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  grossCents: z.number().int(),
  payDate: z.string()
});

const periodSchema = z.object({
  start: z.string(),
  end: z.string()
});

const basDraftSchema = z.object({
  orgId: z.string(),
  period: periodSchema,
  lines: z.array(cashLineSchema),
  payroll: z.array(payrollSchema)
});

export function registerBasRoute(app: FastifyInstance, config: TaxRatesConfig): void {
  app.post('/tax/bas/draft', async (request) => {
    const input = basDraftSchema.parse(request.body) as BasDraftInput;
    return draftBas(input, config);
  });
}
