# Consumer Data Right (CDR) Service

The CDR service normalises datasets produced by the connectors service and
prepares the downstream execution pipeline. It is responsible for validating
transactional completeness, emitting payment execution requests, and
bootstrapping reconciliation.

## Responsibilities

- Validate that the inbound dataset contains the minimum transaction count.
- Calculate debit/credit totals and persist ingestion metadata.
- Fan out payment instructions via `payments.execute` messages.
- Emit `reconciliation.start` to kick off the reconciliation pipeline.
- Record audit events for every batch.

## Configuration

| Key                   | Description                                      | Default |
| --------------------- | ------------------------------------------------ | ------- |
| `minimumTransactions` | Minimum number of transactions required to load. | `1`     |

## Message Flow

1. Receive `cdr.ingest` with dataset payloads.
2. Validate and persist ingestion metadata.
3. Emit `payments.execute` for each payment instruction.
4. Emit `reconciliation.start` summarising the dataset.
5. Emit `audit.log` capturing the ingestion outcome.

## Telemetry

- `cdr.ingest.success`
- `cdr.ingest.failures`

## Testing

The integration suite in `worker/test/workflow.test.ts` verifies that valid
batches trigger payment execution and that failure scenarios are audited.
