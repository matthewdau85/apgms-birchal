export interface TelemetryEvent {
  type: "counter" | "timing";
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: string;
}

export class Telemetry {
  private readonly counters = new Map<string, number>();
  private readonly events: TelemetryEvent[] = [];

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
    this.events.push({
      type: "counter",
      name,
      value,
      tags,
      timestamp: new Date().toISOString(),
    });
  }

  timing(name: string, value: number, tags?: Record<string, string>): void {
    this.events.push({
      type: "timing",
      name,
      value,
      tags,
      timestamp: new Date().toISOString(),
    });
  }

  snapshot(): { counters: Record<string, number>; events: TelemetryEvent[] } {
    return {
      counters: Object.fromEntries(this.counters),
      events: [...this.events],
    };
  }
}
