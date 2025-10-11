export class AuditLogger {
  constructor() {
    this.events = [];
  }

  emit(event) {
    const enriched = { ...event, timestamp: event?.timestamp ?? new Date().toISOString() };
    this.events.push(enriched);
    return enriched;
  }
}
