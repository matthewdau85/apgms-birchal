export interface CounterConfiguration<T extends string = string> {
  name: string;
  help: string;
  labelNames?: T[];
  registers?: Registry[];
}

export interface HistogramConfiguration<T extends string = string> {
  name: string;
  help: string;
  labelNames?: T[];
  buckets?: number[];
  registers?: Registry[];
}

export class Counter<T extends string = string> {
  constructor(configuration: CounterConfiguration<T>);
  inc(labels?: Record<T, string>, value?: number): void;
}

export class Histogram<T extends string = string> {
  constructor(configuration: HistogramConfiguration<T>);
  observe(labels: Record<T, string>, value: number): void;
}

export class Registry {
  readonly contentType: string;
  registerMetric(metric: unknown): unknown;
  getSingleMetric<T = unknown>(name: string): T | undefined;
  metrics(): string;
}

export interface DefaultMetricsOptions {
  register?: Registry;
}

export interface DefaultMetricsCollector {
  stop(): void;
}

export function collectDefaultMetrics(
  options?: DefaultMetricsOptions,
): DefaultMetricsCollector;

export const register: Registry;
