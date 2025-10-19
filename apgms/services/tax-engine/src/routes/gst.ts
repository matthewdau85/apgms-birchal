import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calculateGst, type CashLine, type GstPeriod } from '../lib/gst.js';
import { TaxCode } from '../lib/codes.js';
import type { TaxRatesConfig } from '../config/tax-rates.js';

const cashLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  amountCents: z.number().int(),
  taxCode: z.nativeEnum(TaxCode),
  direction: z.union([z.literal('sale'), z.literal('purchase')]),
  bookingDate: z.string()
});

const periodSchema = z.object({
  start: z.string(),
  end: z.string()
});

const gstRequestSchema = z.object({
  orgId: z.string(),
  lines: z.array(cashLineSchema),
  period: periodSchema
});

export function registerGstRoute(app: FastifyInstance, config: TaxRatesConfig): void {
  app.post('/tax/gst', async (request) => {
    const input = gstRequestSchema.parse(request.body);
    return calculateGst(input.orgId, input.lines as readonly CashLine[], input.period as GstPeriod, config);
  });
}
