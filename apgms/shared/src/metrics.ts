const ESCAPE_LOOKUP: Record<string, string> = {
  "\\": "\\\\",
  "\n": "\\n",
  '"': '\\"',
};

const escapeLabelValue = (value: string): string =>
  value.replace(/[\\\n"]/g, (char) => ESCAPE_LOOKUP[char]);

type LabelBag = Record<string, string>;

type CounterConfig = {
  name: string;
  help: string;
  labelNames: string[];
};

type HistogramConfig = CounterConfig & {
  buckets: number[];
};

const serializeKey = (labelNames: string[], labels: LabelBag): string =>
  labelNames.map((name) => `${name}:${labels[name] ?? ""}`).join("|");

const formatLabels = (labelNames: string[], labels: LabelBag): string => {
  if (!labelNames.length) {
    return "";
  }
  const parts = labelNames.map((name) => `${name}="${escapeLabelValue(labels[name] ?? "")}"`).join(",");
  return `{${parts}}`;
};

class Counter {
  private readonly values = new Map<string, { labels: LabelBag; value: number }>();

  constructor(private readonly config: CounterConfig) {}

  inc(labels: LabelBag = {}, value = 1): void {
    const normalized = this.normalize(labels);
    const key = serializeKey(this.config.labelNames, normalized);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { labels: normalized, value });
    }
  }

  collect(): string[] {
    const lines = [
      `# HELP ${this.config.name} ${this.config.help}`,
      `# TYPE ${this.config.name} counter`,
    ];

    for (const { labels, value } of this.values.values()) {
      lines.push(`${this.config.name}${formatLabels(this.config.labelNames, labels)} ${value}`);
    }

    return lines;
  }

  private normalize(labels: LabelBag): LabelBag {
    const normalized: LabelBag = {};
    for (const name of this.config.labelNames) {
      normalized[name] = labels[name] ?? "";
    }
    return normalized;
  }
}

class Histogram {
  private readonly buckets: number[];
  private readonly values = new Map<
    string,
    { labels: LabelBag; counts: number[]; sum: number; count: number }
  >();

  constructor(private readonly config: HistogramConfig) {
    this.buckets = [...this.config.buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels: LabelBag = {}): void {
    const normalized = this.normalize(labels);
    const key = serializeKey(this.config.labelNames, normalized);
    let record = this.values.get(key);
    if (!record) {
      record = {
        labels: normalized,
        counts: new Array(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.values.set(key, record);
    }

    record.sum += value;
    record.count += 1;

    for (let index = 0; index < this.buckets.length; index += 1) {
      if (value <= this.buckets[index]) {
        record.counts[index] += 1;
      }
    }
  }

  startTimer(labels: LabelBag = {}): (extraLabels?: LabelBag) => void {
    const start = process.hrtime.bigint();
    return (extraLabels: LabelBag = {}) => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000_000;
      this.observe(duration, { ...labels, ...extraLabels });
    };
  }

  collect(): string[] {
    const lines = [
      `# HELP ${this.config.name} ${this.config.help}`,
      `# TYPE ${this.config.name} histogram`,
    ];

    for (const { labels, counts, sum, count } of this.values.values()) {
      let cumulative = 0;
      for (let index = 0; index < this.buckets.length; index += 1) {
        cumulative += counts[index];
        lines.push(
          `${this.config.name}_bucket${formatLabels(
            [...this.config.labelNames, "le"],
            { ...labels, le: this.buckets[index].toString() },
          )} ${cumulative}`,
        );
      }
      lines.push(
        `${this.config.name}_bucket${formatLabels(
          [...this.config.labelNames, "le"],
          { ...labels, le: "+Inf" },
        )} ${count}`,
      );
      lines.push(`${this.config.name}_sum${formatLabels(this.config.labelNames, labels)} ${sum}`);
      lines.push(`${this.config.name}_count${formatLabels(this.config.labelNames, labels)} ${count}`);
    }

    return lines;
  }

  private normalize(labels: LabelBag): LabelBag {
    const normalized: LabelBag = {};
    for (const name of this.config.labelNames) {
      normalized[name] = labels[name] ?? "";
    }
    return normalized;
  }
}

class MetricsRegistry {
  readonly contentType = "text/plain; version=0.0.4";
  private readonly counters: Counter[] = [];
  private readonly histograms: Histogram[] = [];

  registerCounter(counter: Counter): void {
    this.counters.push(counter);
  }

  registerHistogram(histogram: Histogram): void {
    this.histograms.push(histogram);
  }

  async metrics(): Promise<string> {
    const payload = [
      ...this.counters.flatMap((counter) => counter.collect()),
      ...this.histograms.flatMap((histogram) => histogram.collect()),
    ];
    return `${payload.join("\n")}\n`;
  }
}

export const metricsRegistry = new MetricsRegistry();

export const prismaQueryDuration = (() => {
  const histogram = new Histogram({
    name: "prisma_query_duration_seconds",
    help: "Time spent executing Prisma ORM operations",
    labelNames: ["model", "action", "status"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });
  metricsRegistry.registerHistogram(histogram);
  return histogram;
})();

export const prismaQueryErrors = (() => {
  const counter = new Counter({
    name: "prisma_query_errors_total",
    help: "Count of ORM operations that raised an error",
    labelNames: ["model", "action", "error_name"],
  });
  metricsRegistry.registerCounter(counter);
  return counter;
})();

export type CounterMetric = Counter;
export type HistogramMetric = Histogram;

export const createCounter = (config: CounterConfig): Counter => {
  const counter = new Counter(config);
  metricsRegistry.registerCounter(counter);
  return counter;
};

export const createHistogram = (config: HistogramConfig): Histogram => {
  const histogram = new Histogram(config);
  metricsRegistry.registerHistogram(histogram);
  return histogram;
};
