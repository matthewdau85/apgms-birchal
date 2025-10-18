# Payments Service

The payments service executes settlement instructions emitted by the CDR
ingestion pipeline. It validates each payment, records the simulated result, and
notifies reconciliation consumers.

## Responsibilities

- Validate payment amount and currency against configured thresholds.
- Simulate settlement and produce `payments.result` messages.
- Emit `audit.log` entries containing payment execution metadata.
- Update telemetry counters for successful and failed executions.

## Configuration

| Key                  | Description                                        | Default     |
| -------------------- | -------------------------------------------------- | ----------- |
| `maxAmount`          | Maximum allowed payment amount.                    | `1_000_000` |
| `supportedCurrencies`| Array of supported ISO-4217 codes.                 | `['AUD']`   |
| `settlementDelayDays`| Number of days to offset the simulated settlement. | `0`         |

## Message Flow

1. Receive `payments.execute` instructions.
2. Validate the payload and determine settlement status.
3. Emit `payments.result` with the final status and settlement date.
4. Emit an `audit.log` describing the outcome.

## Telemetry

- `payments.execute.success`
- `payments.execute.failures`

## Testing

Integration tests cover successful executions and ensure reconciliation receives
the expected results (`worker/test/workflow.test.ts`).
