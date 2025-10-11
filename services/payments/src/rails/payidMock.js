import { InMemoryPaymentRail } from './inMemoryRail.js';

export class PayIdMockRail extends InMemoryPaymentRail {
  constructor(options = {}) {
    super('payid', options.webhookSecret ?? 'payid-webhook-secret');
  }

  issueWebhook(type, data) {
    const event = this.createWebhookEvent(`${this.name}.${type}`, data);
    const { payload, signature } = this.emitWebhook(event);
    return { event, payload, signature };
  }
}
