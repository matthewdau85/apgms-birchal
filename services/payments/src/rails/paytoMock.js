import { InMemoryPaymentRail } from './inMemoryRail.js';

export class PayToMockRail extends InMemoryPaymentRail {
  constructor(options = {}) {
    super('payto', options.webhookSecret ?? 'payto-webhook-secret');
  }

  issueWebhook(type, data) {
    const event = this.createWebhookEvent(`${this.name}.${type}`, data);
    const { payload, signature } = this.emitWebhook(event);
    return { event, payload, signature };
  }
}
