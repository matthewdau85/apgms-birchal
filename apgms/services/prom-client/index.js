const DEFAULT_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

class Registry {
  constructor() {
    this._metrics = new Map();
    this.contentType = DEFAULT_CONTENT_TYPE;
  }

  registerMetric(metric) {
    if (!this._metrics.has(metric.name)) {
      this._metrics.set(metric.name, metric);
    }
    return metric;
  }

  getSingleMetric(name) {
    return this._metrics.get(name);
  }

  metrics() {
    return Array.from(this._metrics.values())
      .map((metric) => metric.export())
      .join("\n");
  }
}

const globalRegister = new Registry();

function ensureLabels(labelNames, labels = {}) {
  const resolved = {};
  for (const name of labelNames) {
    if (name in labels) {
      resolved[name] = String(labels[name]);
    } else {
      resolved[name] = "";
    }
  }
  return resolved;
}

function formatLabels(labels) {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return "";
  }
  const formatted = entries
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
    .join(",");
  return formatted.length > 0 ? `{${formatted}}` : "";
}

class Counter {
  constructor(config) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames ?? [];
    this._values = new Map();
    const registers = config.registers ?? [globalRegister];
    registers.forEach((reg) => reg.registerMetric(this));
  }

  inc(labels = {}, value = 1) {
    const resolved = ensureLabels(this.labelNames, labels);
    const key = JSON.stringify(resolved);
    const current = this._values.get(key) ?? 0;
    this._values.set(key, current + value);
  }

  export() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this._values.size === 0) {
      lines.push(`${this.name} 0`);
      return lines.join("\n");
    }

    for (const [key, value] of this._values.entries()) {
      const labels = JSON.parse(key);
      lines.push(`${this.name}${formatLabels(labels)} ${value}`);
    }
    return lines.join("\n");
  }
}

class Histogram {
  constructor(config) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames ?? [];
    this.buckets = [...(config.buckets ?? [])];
    this._observations = new Map();
    const registers = config.registers ?? [globalRegister];
    registers.forEach((reg) => reg.registerMetric(this));
  }

  observe(labels = {}, value) {
    const resolved = ensureLabels(this.labelNames, labels);
    const key = JSON.stringify(resolved);
    if (!this._observations.has(key)) {
      const counts = new Map();
      for (const bucket of this.buckets) {
        counts.set(bucket, 0);
      }
      counts.set("+Inf", 0);
      this._observations.set(key, { sum: 0, count: 0, buckets: counts });
    }
    const entry = this._observations.get(key);
    entry.sum += value;
    entry.count += 1;
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        entry.buckets.set(bucket, (entry.buckets.get(bucket) ?? 0) + 1);
      }
    }
    entry.buckets.set("+Inf", (entry.buckets.get("+Inf") ?? 0) + 1);
  }

  export() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    if (this._observations.size === 0) {
      lines.push(`${this.name}_count 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      return lines.join("\n");
    }

    for (const [key, stats] of this._observations.entries()) {
      const labels = JSON.parse(key);
      for (const [bucket, count] of stats.buckets.entries()) {
        const bucketLabels = { ...labels, le: String(bucket) };
        lines.push(`${this.name}_bucket${formatLabels(bucketLabels)} ${count}`);
      }
      lines.push(`${this.name}_count${formatLabels(labels)} ${stats.count}`);
      lines.push(`${this.name}_sum${formatLabels(labels)} ${stats.sum}`);
    }
    return lines.join("\n");
  }
}

function collectDefaultMetrics(options = {}) {
  const reg = options.register ?? globalRegister;
  if (!reg.getSingleMetric("process_info")) {
    const metric = new Counter({
      name: "process_info",
      help: "Static process information",
      labelNames: ["pid"],
      registers: [reg],
    });
    metric.inc({ pid: String(process.pid) });
  }
  return { stop() {} };
}

export { collectDefaultMetrics, Counter, Histogram, Registry };
export const register = globalRegister;
