# Reconciliation Service

The reconciliation service correlates payment execution results with the source
ledger data. Once every expected payment for a batch has been processed it
produces registry updates and SBR reports.

## Responsibilities

- Track reconciliation batches from the initial `reconciliation.start` message.
- Capture `payments.result` events and determine settlement success.
- Publish `registries.update` envelopes for each registry instruction.
- Publish `sbr.submit` to satisfy statutory reporting obligations.
- Emit audit logs when a batch completes, including unmatched payment details.

## Configuration

| Key              | Description                                     | Default |
| ---------------- | ----------------------------------------------- | ------- |
| `autoCloseBatches` | Automatically close batches when all results arrive. | `true`  |

## Message Flow

1. Receive `reconciliation.start` describing the dataset summary.
2. Store expected payment instructions and await `payments.result` messages.
3. When the last result arrives, publish:
   - `reconciliation.completed`
   - `registries.update` (one per instruction)
   - `sbr.submit`
   - `audit.log`

## Telemetry

- `reconciliation.start.success`
- `reconciliation.result.failures` (if unexpected results arrive)
- `reconciliation.complete.success`

## Testing

Integration coverage in `worker/test/workflow.test.ts` confirms that batches
complete successfully and that missing connectors never trigger reconciliation.
