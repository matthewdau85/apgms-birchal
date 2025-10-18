import http from "node:http";
import process from "node:process";
import type { ServiceLogger } from "./logger";

type Labels = Record<string, string | number>;

type MetricOptions = {
  name: string;
  help: string;
  labelNames?: string[];
};

const DEFAULT_CONTENT_TYPE = "text/plain; version=0.0.4";

const serializeLabels = (labels: Labels) => {
  const entries = Object.entries(labels).sort(([a], [b]) => (a > b ? 1 : -1));
  if (entries.length === 0) {
    return "{}";
  }
  return `{${entries.map(([key, value]) => `${key}="${String(value)}"`).join(",")}}`;
};

abstract class MetricBase {
  protected readonly name: string;
  protected readonly help: string;
  protected readonly labelNames: string[];
  protected readonly defaultLabels: Labels;

  constructor(options: MetricOptions, defaultLabels: Labels) {
    this.name = options.name;
    this.help = options.help;
    this.labelNames = options.labelNames ?? [];
    this.defaultLabels = defaultLabels;
  }

  abstract snapshotLines(): string[];

  headerLines() {
    return [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.typeName()}`];
  }

  abstract typeName(): string;
}

type CounterSample = {
  labels: Labels;
  value: number;
};

class CounterMetric extends MetricBase {
  private readonly samples = new Map<string, CounterSample>();

  inc(labels: Labels = {}, value = 1) {
    const merged = { ...this.defaultLabels, ...labels };
    const key = serializeLabels(merged);
    const sample = this.samples.get(key) ?? { labels: merged, value: 0 };
    sample.value += value;
    this.samples.set(key, sample);
  }

  snapshotLines() {
    return Array.from(this.samples.values())
      .sort((a, b) => (serializeLabels(a.labels) > serializeLabels(b.labels) ? 1 : -1))
      .map((sample) => `${this.name}${serializeLabels(sample.labels)} ${sample.value}`);
  }

  typeName() {
    return "counter";
  }
}

type GaugeSample = CounterSample;

class GaugeMetric extends MetricBase {
  private readonly samples = new Map<string, GaugeSample>();

  set(value: number, labels: Labels = {}) {
    const merged = { ...this.defaultLabels, ...labels };
    const key = serializeLabels(merged);
    this.samples.set(key, { labels: merged, value });
  }

  snapshotLines() {
    return Array.from(this.samples.values())
      .sort((a, b) => (serializeLabels(a.labels) > serializeLabels(b.labels) ? 1 : -1))
      .map((sample) => `${this.name}${serializeLabels(sample.labels)} ${sample.value}`);
  }

  typeName() {
    return "gauge";
  }
}

type HistogramSample = {
  labels: Labels;
  sum: number;
  count: number;
  buckets: number[];
};

class HistogramMetric extends MetricBase {
  private readonly buckets: number[];
  private readonly samples = new Map<string, HistogramSample>();

  constructor(
    options: MetricOptions & { buckets?: number[] },
    defaultLabels: Labels,
  ) {
    super(options, defaultLabels);
    this.buckets = options.buckets ?? [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  observe(labels: Labels = {}, value: number) {
    const merged = { ...this.defaultLabels, ...labels };
    const key = serializeLabels(merged);
    const sample =
      this.samples.get(key) ?? {
        labels: merged,
        sum: 0,
        count: 0,
        buckets: new Array(this.buckets.length).fill(0),
      };

    sample.sum += value;
    sample.count += 1;
    this.buckets.forEach((bucket, index) => {
      if (value <= bucket) {
        sample.buckets[index] += 1;
      }
    });

    this.samples.set(key, sample);
  }

  startTimer(labels: Labels = {}) {
    const start = process.hrtime.bigint();
    return (additional: Labels = {}) => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;
      this.observe({ ...labels, ...additional }, duration);
    };
  }

  snapshotLines() {
    const lines: string[] = [];
    const sorted = Array.from(this.samples.values()).sort((a, b) =>
      serializeLabels(a.labels) > serializeLabels(b.labels) ? 1 : -1,
    );

    for (const sample of sorted) {
      this.buckets.forEach((bucket, index) => {
        const bucketLabels = {
          ...sample.labels,
          le: bucket,
        };
        lines.push(
          `${this.name}_bucket${serializeLabels(bucketLabels)} ${sample.buckets[index]}`,
        );
      });
      const infLabels = { ...sample.labels, le: "+Inf" };
      lines.push(`${this.name}_bucket${serializeLabels(infLabels)} ${sample.count}`);
      lines.push(`${this.name}_sum${serializeLabels(sample.labels)} ${sample.sum}`);
      lines.push(`${this.name}_count${serializeLabels(sample.labels)} ${sample.count}`);
    }

    return lines;
  }

  typeName() {
    return "histogram";
  }
}

type RegistryConfig = {
  serviceName: string;
  defaultLabels?: Labels;
};

class MetricsRegistry {
  private readonly metrics: MetricBase[] = [];
  private readonly defaultLabels: Labels;
  private readonly processUptime: GaugeMetric;
  private readonly processMemory: GaugeMetric;
  private readonly processHeap: GaugeMetric;
  private readonly startedAt = Date.now();

  constructor({ serviceName, defaultLabels = {} }: RegistryConfig) {
    this.defaultLabels = { service: serviceName, ...defaultLabels };

    this.processUptime = new GaugeMetric(
      { name: "process_uptime_seconds", help: "Process uptime in seconds" },
      this.defaultLabels,
    );

    this.processMemory = new GaugeMetric(
      {
        name: "process_resident_memory_bytes",
        help: "Resident set size in bytes",
      },
      this.defaultLabels,
    );

    this.processHeap = new GaugeMetric(
      {
        name: "process_heap_used_bytes",
        help: "Heap used in bytes",
      },
      this.defaultLabels,
    );

    this.metrics.push(this.processUptime, this.processMemory, this.processHeap);
  }

  register(metric: MetricBase) {
    this.metrics.push(metric);
    return metric;
  }

  counter(options: MetricOptions) {
    return this.register(new CounterMetric(options, this.defaultLabels));
  }

  histogram(options: MetricOptions & { buckets?: number[] }) {
    return this.register(new HistogramMetric(options, this.defaultLabels));
  }

  gauge(options: MetricOptions) {
    return this.register(new GaugeMetric(options, this.defaultLabels));
  }

  private refreshProcessMetrics() {
    const uptimeSeconds = (Date.now() - this.startedAt) / 1000;
    this.processUptime.set(uptimeSeconds);

    const memory = process.memoryUsage();
    this.processMemory.set(memory.rss);
    this.processHeap.set(memory.heapUsed);
  }

  async metrics() {
    this.refreshProcessMetrics();
    return this.metrics
      .flatMap((metric) => [...metric.headerLines(), ...metric.snapshotLines()])
      .join("\n");
  }

  get contentType() {
    return DEFAULT_CONTENT_TYPE;
  }
}

type MetricsServerConfig = {
  register: MetricsRegistry;
  port: number;
  host?: string;
  logger?: ServiceLogger;
};

export const createMetricsRegistry = ({
  serviceName,
  defaultLabels = {},
}: RegistryConfig) => new MetricsRegistry({ serviceName, defaultLabels });

export const createHttpMetrics = (register: MetricsRegistry) => {
  const requestDuration = register.histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
  });

  const requestCount = register.counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
  });

  return { requestDuration, requestCount };
};

export const startMetricsServer = ({
  register,
  port,
  host = "0.0.0.0",
  logger,
}: MetricsServerConfig) => {
  const server = http.createServer(async (req, res) => {
    if (!req.url || req.method !== "GET" || req.url !== "/metrics") {
      res.statusCode = 404;
      res.end();
      return;
    }

    try {
      const metrics = await register.metrics();
      res.setHeader("Content-Type", register.contentType);
      res.writeHead(200);
      res.end(metrics);
    } catch (error) {
      logger?.error({ error }, "failed to collect metrics");
      res.writeHead(500);
      res.end("metrics collection failed");
    }
  });

  server.listen(port, host, () => {
    logger?.info({ port, host }, "metrics server listening");
  });

  return server;
};

export { CounterMetric as Counter, GaugeMetric as Gauge, HistogramMetric as Histogram };
