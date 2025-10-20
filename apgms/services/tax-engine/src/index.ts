import type { FastifyInstance } from 'fastify';
import { taxRatesConfig, type TaxRatesConfig } from './config/tax-rates.js';
import { registerGstRoute } from './routes/gst.js';
import { registerPaygwRoute } from './routes/paygw.js';
import { registerBasRoute } from './routes/bas.js';

export interface TaxEngineOptions {
  readonly config?: TaxRatesConfig;
}

export async function registerTaxEngine(
  app: FastifyInstance,
  options: TaxEngineOptions = {}
): Promise<void> {
  const config = options.config ?? taxRatesConfig;
  registerGstRoute(app, config);
  registerPaygwRoute(app, config);
  registerBasRoute(app, config);
}

export * from './lib/gst.js';
export * from './lib/paygw.js';
export * from './lib/bas.js';
export * from './lib/codes.js';
