import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicyDataset } from './loader.js';
import type { PaygwPeriod } from './types.js';
import type { BasLabel, BasLabelMapping, GstMetadata, GstRate, PaygwPolicy } from './types.js';
import type { PaygwScaleDataset, PolicyDataset } from './loader.js';

function isWithinRange(date: Date, from: Date, to: Date | null): boolean {
  if (date.getTime() < from.getTime()) {
    return false;
  }
  if (to) {
    return date.getTime() <= to.getTime();
  }
  return true;
}

function applyRounding(value: number, dataset: PaygwScaleDataset): number {
  const { method, precision, half } = dataset.roundingRule;
  const factor = Math.pow(10, precision);
  const scaledValue = value * factor;

  if (method === 'UP') {
    return Math.ceil(scaledValue) / factor;
  }

  if (method === 'DOWN') {
    return Math.floor(scaledValue) / factor;
  }

  const floorValue = Math.floor(scaledValue);
  const fraction = scaledValue - floorValue;

  if (fraction > 0.5) {
    return (floorValue + 1) / factor;
  }

  if (fraction < 0.5) {
    return floorValue / factor;
  }

  switch (half ?? 'UP') {
    case 'DOWN':
      return floorValue / factor;
    case 'EVEN':
      return (floorValue % 2 === 0 ? floorValue : floorValue + 1) / factor;
    case 'UP':
    default:
      return (floorValue + 1) / factor;
  }
}

export class PolicyRepository {
  constructor(private readonly dataset: PolicyDataset) {}

  getPaygwPolicy(): PaygwPolicy {
    return this.dataset.paygw.policy;
  }

  private resolveScale(period: PaygwPeriod, date: Date): PaygwScaleDataset {
    const match = this.dataset.paygw.scales
      .filter((scale) => scale.period === period)
      .find((scale) =>
        isWithinRange(
          date,
          scale.effectiveFromDate,
          scale.effectiveToDate,
        ),
      );

    if (!match) {
      throw new Error(`No PAYGW scale for period ${period} on ${date.toISOString()}`);
    }

    return match;
  }

  getPaygwFor(period: PaygwPeriod, earnings: number, asAt: Date = new Date()): number {
    if (earnings < 0) {
      throw new Error('Earnings cannot be negative');
    }
    const scale = this.resolveScale(period, asAt);
    const threshold = scale.thresholds.find((item) =>
      earnings >= item.minimum && (item.maximum === null || earnings < item.maximum),
    );

    if (!threshold) {
      throw new Error(`No threshold for earnings ${earnings} in scale ${scale.id}`);
    }

    const withholding = threshold.baseWithholding + (earnings - threshold.minimum) * threshold.marginalRate;
    return applyRounding(withholding, scale);
  }

  getGstRate(asAt: Date, adjustmentType: GstRate['adjustmentType'] = 'standard'): GstRate {
    const { rates } = this.dataset.gst;
    const matches = rates
      .filter((rate) => rate.adjustmentType === adjustmentType)
      .map((rate) => ({
        rate,
        from: new Date(rate.effectiveFrom),
        to: rate.effectiveTo ? new Date(rate.effectiveTo) : null,
      }))
      .filter(({ from, to }) => isWithinRange(asAt, from, to));

    if (matches.length === 0) {
      throw new Error(
        `No GST rate available for ${adjustmentType} on ${asAt.toISOString()}`,
      );
    }

    return matches.sort((a, b) => b.from.getTime() - a.from.getTime())[0].rate;
  }

  getBasLabel(label: string): BasLabel {
    const { mappings } = this.dataset.bas;
    const mapping = mappings.find((entry) => entry.label === label);
    if (!mapping) {
      throw new Error(`Unknown BAS label ${label}`);
    }
    return mapping;
  }

  getBasMetadata(): BasLabelMapping {
    return this.dataset.bas;
  }

  getGstMetadata(): GstMetadata {
    return this.dataset.gst;
  }
}

export async function createPolicyRepository(dataRoot?: string): Promise<PolicyRepository> {
  if (dataRoot) {
    const dataset = await loadPolicyDataset(dataRoot);
    return new PolicyRepository(dataset);
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '..', '..', 'policy-data'),
    path.resolve(moduleDir, '..', '..', '..', 'policy-data'),
  ];

  const root = candidates.find((candidate) => existsSync(path.join(candidate, 'paygw', 'policy.json')));
  if (!root) {
    throw new Error('Unable to locate policy-data directory');
  }
  const dataset = await loadPolicyDataset(root);
  return new PolicyRepository(dataset);
}
