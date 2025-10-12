import { createPolicyRepository, PolicyRepository } from './policy/repository.js';
import type { PaygwPeriod, GstRate } from './policy/types.js';

export class TaxEngine {
  constructor(private readonly repository: PolicyRepository) {}

  async getPaygwFor(period: PaygwPeriod, earnings: number, asAt: Date = new Date()): Promise<number> {
    return this.repository.getPaygwFor(period, earnings, asAt);
  }

  async getGstRate(
    asAt: Date,
    adjustmentType: GstRate['adjustmentType'] = 'standard',
  ): Promise<number> {
    return this.repository.getGstRate(asAt, adjustmentType).rate;
  }

  getBasLabel(label: string) {
    return this.repository.getBasLabel(label);
  }
}

export async function createTaxEngine(dataRoot?: string): Promise<TaxEngine> {
  const repository = await createPolicyRepository(dataRoot);
  return new TaxEngine(repository);
}
