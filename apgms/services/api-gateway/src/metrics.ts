import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

export interface MetricsCollectorOptions {
  /** Directory where raw logs and summaries should be written. */
  outputDir?: string;
}

interface InternalStats {
  durations: number[];
  totalDuration: number;
  maxDuration: number;
  count: number;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function recordDuration(map: Map<string, InternalStats>, key: string, durationMs: number) {
  const entry = map.get(key);
  if (entry) {
    entry.count += 1;
    entry.totalDuration += durationMs;
    entry.maxDuration = Math.max(entry.maxDuration, durationMs);
    entry.durations.push(durationMs);
  } else {
    map.set(key, {
      count: 1,
      totalDuration: durationMs,
      maxDuration: durationMs,
      durations: [durationMs],
    });
  }
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export interface MetricsSummaryEntry {
  key: string;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
}

export interface MetricsSummary {
  generatedAt: string;
  requests: MetricsSummaryEntry[];
  dbOperations: MetricsSummaryEntry[];
}

export class MetricsCollector {
  private readonly outputDir: string;
  private readonly requestLogPath: string;
  private readonly dbLogPath: string;
  private requestStats = new Map<string, InternalStats>();
  private dbStats = new Map<string, InternalStats>();

  constructor(options: MetricsCollectorOptions = {}) {
    this.outputDir = options.outputDir ?? path.resolve(process.cwd(), "metrics");
    ensureDir(this.outputDir);
    this.requestLogPath = path.join(this.outputDir, "requests.log");
    this.dbLogPath = path.join(this.outputDir, "db.log");
    fs.writeFileSync(this.requestLogPath, "", { flag: "w" });
    fs.writeFileSync(this.dbLogPath, "", { flag: "w" });
  }

  recordRequest(method: string, route: string, statusCode: number, durationMs: number) {
    const key = `${method} ${route}`;
    recordDuration(this.requestStats, key, durationMs);
    fs.appendFileSync(
      this.requestLogPath,
      `${JSON.stringify({ method, route, statusCode, durationMs })}\n`
    );
  }

  recordDbOperation(operation: string, durationMs: number) {
    recordDuration(this.dbStats, operation, durationMs);
    fs.appendFileSync(
      this.dbLogPath,
      `${JSON.stringify({ operation, durationMs })}\n`
    );
  }

  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordDbOperation(operation, duration);
    }
  }

  buildSummary(): MetricsSummary {
    const summarise = (stats: Map<string, InternalStats>): MetricsSummaryEntry[] => {
      return [...stats.entries()]
        .map(([key, value]) => ({
          key,
          count: value.count,
          avgDurationMs: value.totalDuration / value.count,
          p95DurationMs: percentile(value.durations, 95),
          maxDurationMs: value.maxDuration,
        }))
        .sort((a, b) => b.count - a.count || b.avgDurationMs - a.avgDurationMs);
    };

    return {
      generatedAt: new Date().toISOString(),
      requests: summarise(this.requestStats),
      dbOperations: summarise(this.dbStats),
    };
  }

  async flush(): Promise<MetricsSummary> {
    const summary = this.buildSummary();
    const summaryPath = path.join(this.outputDir, "summary.json");
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    return summary;
  }
}

export function createMetricsCollector(options?: MetricsCollectorOptions) {
  return new MetricsCollector(options);
}
