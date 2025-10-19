import { AlertEvent, Clock } from "./types";

export class AlertBus {
  private readonly alerts: AlertEvent[] = [];

  constructor(private readonly clock: Clock = () => new Date()) {}

  emit(event: Omit<AlertEvent, "emittedAt">): AlertEvent {
    const created: AlertEvent = {
      ...event,
      emittedAt: this.clock(),
    };
    this.alerts.push(created);
    return { ...created };
  }

  all(): AlertEvent[] {
    return this.alerts.map((alert) => ({ ...alert }));
  }
}
