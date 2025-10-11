import crypto from 'node:crypto';
import { ensureRptValidity, stubVerifyRpt } from '../state/rptStateMachine.js';
import { createHmacSignature, safeJsonStringify } from '../utils/webhook.js';

/**
 * @typedef {import('./IPaymentRail.js').Mandate} Mandate
 * @typedef {import('./IPaymentRail.js').MandateRequest} MandateRequest
 * @typedef {import('./IPaymentRail.js').DebitRequest} DebitRequest
 * @typedef {import('./IPaymentRail.js').Debit} Debit
 * @typedef {import('./IPaymentRail.js').RefundRequest} RefundRequest
 * @typedef {import('./IPaymentRail.js').Refund} Refund
 * @typedef {import('./IPaymentRail.js').OperationOptions} OperationOptions
 * @typedef {import('./IPaymentRail.js').PaymentStatusResult} PaymentStatusResult
 * @typedef {import('./IPaymentRail.js').WebhookEvent} WebhookEvent
 * @typedef {import('./IPaymentRail.js').WebhookValidationResult} WebhookValidationResult
 */

/**
 * @template T
 * @typedef {import('./IPaymentRail.js').WebhookValidationResult<T>} WebhookValidationResultGeneric
 */

const OPERATIONS = {
  createMandate: 'createMandate',
  initiateDebit: 'initiateDebit',
  refund: 'refund'
};

export class InMemoryPaymentRail {
  /**
   * @param {string} name
   * @param {string} webhookSecret
   */
  constructor(name, webhookSecret) {
    this.name = name;
    this.webhookSecret = webhookSecret;
    /** @type {Map<string, Mandate>} */
    this.mandates = new Map();
    /** @type {Map<string, any>} */
    this.debits = new Map();
    /** @type {Map<string, any>} */
    this.refunds = new Map();
    /** @type {Map<string, unknown>} */
    this.idempotencyStore = new Map();
    /** @type {Set<string>} */
    this.processedWebhookIds = new Set();
    /** @type {Map<string, PaymentStatusResult>} */
    this.statuses = new Map();
  }

  /**
   * @param {string} id
   * @returns {Mandate | undefined}
   */
  getMandateById(id) {
    const mandate = this.mandates.get(id);
    return mandate ? { ...mandate } : undefined;
  }

  /**
   * @returns {Debit[]}
   */
  listDebits() {
    return Array.from(this.debits.values()).map((debit) => ({ ...debit }));
  }

  /**
   * @returns {Refund[]}
   */
  listRefunds() {
    return Array.from(this.refunds.values()).map((refund) => ({ ...refund }));
  }

  /**
   * @param {MandateRequest} request
   * @param {OperationOptions} [options]
   * @returns {Promise<Mandate>}
   */
  async createMandate(request, options) {
    return this.withIdempotency(OPERATIONS.createMandate, options, async () => {
      const now = new Date();
      const mandate = {
        id: crypto.randomUUID(),
        createdAt: now,
        status: 'pending',
        rptStatus: 'pending',
        ...request
      };
      this.mandates.set(mandate.id, mandate);
      this.trackStatus({
        reference: mandate.id,
        status: 'pending',
        lastUpdated: now,
        details: 'Mandate created.'
      });
      return mandate;
    });
  }

  /**
   * @param {DebitRequest} request
   * @param {OperationOptions} [options]
   * @returns {Promise<Debit>}
   */
  async initiateDebit(request, options) {
    return this.withIdempotency(OPERATIONS.initiateDebit, options, async () => {
      const mandate = this.mandates.get(request.mandateId);
      if (!mandate) {
        throw new Error(`Mandate ${request.mandateId} not found.`);
      }

      ensureRptValidity(mandate, new Date(), stubVerifyRpt);

      const now = new Date();
      const debit = {
        id: crypto.randomUUID(),
        createdAt: now,
        status: 'settled',
        statusHistory: [],
        ...request
      };

      debit.statusHistory.push({
        reference: debit.id,
        status: 'settled',
        lastUpdated: now,
        details: `Debit of ${request.amountCents} ${request.currency}`
      });

      this.debits.set(debit.id, debit);
      this.trackStatus({
        reference: debit.id,
        status: 'settled',
        lastUpdated: now,
        details: 'Debit settled immediately (mock).'
      });
      return { ...debit };
    });
  }

  /**
   * @param {RefundRequest} request
   * @param {OperationOptions} [options]
   * @returns {Promise<Refund>}
   */
  async refund(request, options) {
    return this.withIdempotency(OPERATIONS.refund, options, async () => {
      const debit = this.debits.get(request.debitId);
      if (!debit) {
        throw new Error(`Debit ${request.debitId} not found.`);
      }

      if (debit.status !== 'settled') {
        throw new Error('Only settled debits can be refunded in the mock rail.');
      }

      const amountCents = request.amountCents ?? debit.amountCents;
      if (amountCents > debit.amountCents) {
        throw new Error('Cannot refund more than the original debit amount.');
      }

      const now = new Date();
      const refund = {
        id: crypto.randomUUID(),
        debitId: debit.id,
        amountCents,
        status: 'refunded',
        createdAt: now,
        metadata: request.metadata,
        statusHistory: [
          {
            reference: debit.id,
            status: 'refunded',
            lastUpdated: now,
            details: request.reason ?? 'Refund processed.'
          }
        ]
      };
      this.refunds.set(refund.id, refund);
      this.trackStatus({
        reference: refund.id,
        status: 'refunded',
        lastUpdated: now,
        details: request.reason ?? 'Refund processed.'
      });
      return { ...refund };
    });
  }

  /**
   * @param {string} reference
   * @returns {Promise<PaymentStatusResult>}
   */
  async getStatus(reference) {
    if (this.statuses.has(reference)) {
      return this.statuses.get(reference);
    }

    const debit = this.debits.get(reference);
    if (debit && debit.statusHistory.length > 0) {
      return debit.statusHistory[debit.statusHistory.length - 1];
    }

    const refund = this.refunds.get(reference);
    if (refund && refund.statusHistory.length > 0) {
      return refund.statusHistory[refund.statusHistory.length - 1];
    }

    const mandate = this.mandates.get(reference);
    if (mandate) {
      return {
        reference: mandate.id,
        status: mandate.status === 'revoked' ? 'failed' : 'pending',
        lastUpdated: mandate.createdAt,
        details: `Mandate status: ${mandate.status}`
      };
    }

    throw new Error(`Unknown reference ${reference}`);
  }

  /**
   * @template T
   * @param {string} payload
   * @param {string} signature
   * @returns {WebhookValidationResultGeneric<T>}
   */
  verifyWebhook(payload, signature) {
    let provided;
    let expected;
    try {
      provided = Buffer.from(signature, 'hex');
      expected = Buffer.from(createHmacSignature(this.webhookSecret, payload), 'hex');
    } catch (_error) {
      return { valid: false, replayed: false };
    }

    if (provided.length !== expected.length) {
      return { valid: false, replayed: false };
    }

    if (!crypto.timingSafeEqual(provided, expected)) {
      return { valid: false, replayed: false };
    }

    const event = JSON.parse(payload);
    if (this.processedWebhookIds.has(event.id)) {
      return { valid: false, replayed: true, event };
    }

    this.processedWebhookIds.add(event.id);
    return { valid: true, replayed: false, event };
  }

  /**
   * @template T
   * @param {WebhookEvent<T>} event
   * @returns {{ payload: string, signature: string }}
   */
  emitWebhook(event) {
    const payload = safeJsonStringify(event);
    return {
      payload,
      signature: createHmacSignature(this.webhookSecret, payload)
    };
  }

  /**
   * @template T
   * @param {string} type
   * @param {T} data
   * @returns {WebhookEvent<T>}
   */
  createWebhookEvent(type, data) {
    return {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      data
    };
  }

  /**
   * @param {PaymentStatusResult} result
   */
  trackStatus(result) {
    this.statuses.set(result.reference, result);
  }

  /**
   * @template T
   * @param {string} operation
   * @param {OperationOptions} [options]
   * @param {() => Promise<T>} handler
   * @returns {Promise<T>}
   */
  async withIdempotency(operation, options, handler) {
    const key = options && options.idempotencyKey;
    if (!key) {
      return handler();
    }

    const storeKey = `${operation}:${key}`;
    if (this.idempotencyStore.has(storeKey)) {
      return this.idempotencyStore.get(storeKey);
    }

    const result = await handler();
    this.idempotencyStore.set(storeKey, result);
    return result;
  }
}
