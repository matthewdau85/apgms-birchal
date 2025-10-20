import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calculatePaygw, type PayPeriod, type PayrollEntry } from '../lib/paygw.js';
import type { TaxRatesConfig } from '../config/tax-rates.js';

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

const paygwRequestSchema = z.object({
  orgId: z.string(),
  payroll: z.array(payrollSchema),
  period: periodSchema
});

export function registerPaygwRoute(app: FastifyInstance, config: TaxRatesConfig): void {
  app.post('/tax/paygw', async (request) => {
    const input = paygwRequestSchema.parse(request.body);
    return calculatePaygw(
      input.orgId,
      input.payroll as readonly PayrollEntry[],
      input.period as PayPeriod,
      config
    );
  });
}
