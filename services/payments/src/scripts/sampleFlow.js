import { exportAbaFile } from '../exporters/abaExporter.js';
import { PayIdMockRail } from '../rails/payidMock.js';
import { PayToMockRail } from '../rails/paytoMock.js';

async function main() {
  const payTo = new PayToMockRail();
  const payId = new PayIdMockRail();

  console.log('--- PAYTO FLOW ---');
  const mandate = await payTo.createMandate(
    { customerId: 'cust-001', reference: 'INV-1001' },
    { idempotencyKey: 'mandate-cust-001' }
  );
  console.log('Mandate created:', mandate);

  const debit = await payTo.initiateDebit(
    { mandateId: mandate.id, amountCents: 12500, currency: 'AUD' },
    { idempotencyKey: 'debit-inv-1001' }
  );
  console.log('Debit settled:', debit);

  const refund = await payTo.refund({ debitId: debit.id, reason: 'Customer request' });
  console.log('Refund processed:', refund);

  const status = await payTo.getStatus(debit.id);
  console.log('Current debit status:', status);

  const webhookDispatch = payTo.issueWebhook('payment.settled', { debitId: debit.id, amountCents: debit.amountCents });
  console.log('Webhook dispatched:', webhookDispatch.event);

  const verified = payTo.verifyWebhook(webhookDispatch.payload, webhookDispatch.signature);
  console.log('Webhook verification result:', verified);

  const replayCheck = payTo.verifyWebhook(webhookDispatch.payload, webhookDispatch.signature);
  console.log('Replay check result:', replayCheck);

  console.log('\n--- PAYID FLOW ---');
  const payIdMandate = await payId.createMandate({ customerId: 'cust-002', reference: 'INV-2001' });
  const payIdDebit = await payId.initiateDebit({ mandateId: payIdMandate.id, amountCents: 9900, currency: 'AUD' });
  console.log('PayID debit settled:', payIdDebit);

  console.log('\n--- ABA EXPORT ---');
  const aba = exportAbaFile(
    {
      financialInstitution: 'ANZ',
      userName: 'Birchal',
      userNumber: '654321',
      description: 'Payouts',
      processDate: new Date('2024-03-12T00:00:00.000Z')
    },
    [
      {
        bsb: '123-456',
        accountNumber: '987654321',
        accountName: 'First Investor',
        amountCents: 12500,
        lodgementReference: 'INV-1001',
        traceBsb: '654-321',
        traceAccountNumber: '000111222',
        remitterName: 'Birchal'
      },
      {
        bsb: '082-991',
        accountNumber: '000123456',
        accountName: 'Second Investor',
        amountCents: 9900,
        lodgementReference: 'INV-2001',
        traceBsb: '654-321',
        traceAccountNumber: '000111222',
        remitterName: 'Birchal'
      }
    ]
  );
  console.log(aba);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
