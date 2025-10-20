class CounterMetric {
  private value = 0;

  constructor(
    private readonly name: string,
    private readonly help: string,
  ) {}

  inc(amount = 1): void {
    this.value += amount;
  }

  render(): string {
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
      `${this.name} ${this.value}`,
    ].join('\n');
  }
}

export class PaymentsMetrics {
  readonly remittanceEnqueued = new CounterMetric(
    'payments_remittance_enqueued_total',
    'Total number of remittances enqueued',
  );

  readonly remittanceInitiated = new CounterMetric(
    'payments_remittance_initiated_total',
    'Total number of remittances initiated',
  );

  readonly remittanceSettled = new CounterMetric(
    'payments_remittance_settled_total',
    'Total number of remittances settled',
  );

  readonly remittanceRetries = new CounterMetric(
    'payments_remittance_retry_total',
    'Number of remittances retried after failure',
  );

  metrics(): string {
    return [
      this.remittanceEnqueued.render(),
      this.remittanceInitiated.render(),
      this.remittanceSettled.render(),
      this.remittanceRetries.render(),
    ].join('\n');
  }
}
