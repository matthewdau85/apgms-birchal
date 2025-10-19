import { drainRemittanceQueue, getGateState, PaytoRemittanceRequest } from '../../shared/src/payto.js';
import { remit } from '../../services/payments/src/adapters/payto.mock.js';
import type { PaytoRemittance } from '../../services/payments/src/adapters/payto.mock.js';

export async function processQueuedRemittances(): Promise<PaytoRemittance[]> {
  if (getGateState() !== 'OPEN') {
    return [];
  }

  const queued = drainRemittanceQueue();
  const processed: PaytoRemittance[] = [];

  for (const entry of queued) {
    const request: PaytoRemittanceRequest = {
      agreementId: entry.agreementId,
      amount: entry.amount,
      currency: entry.currency,
      metadata: entry.metadata,
      remitId: entry.remitId,
    };

    const result = remit(request);
    processed.push(result);
  }

  return processed;
}
