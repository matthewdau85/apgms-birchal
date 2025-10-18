# Connectors Service

The connectors service translates upstream integration payloads (e.g. Xero or
bank feeds) into canonical datasets that can be consumed by the rest of the
platform. It listens for `connectors.sync.request` messages and emits a single
`cdr.ingest` message for each successful sync.

## Responsibilities

- Validate that a connector is configured before attempting a sync.
- Enforce that datasets contain at least one account and transaction.
- Emit audit events and telemetry for both success and failure paths.
- Forward the dataset to the CDR service for ingestion.

## Configuration

| Key                     | Description                                               | Default       |
| ----------------------- | --------------------------------------------------------- | ------------- |
| `connectors`            | Map of connector IDs to dataset definitions or factories. | `{}`          |
| `defaultReportingPeriod` | Fallback reporting period if the dataset omits one.      | Current month |

Datasets must follow the `ConnectorDataset` schema defined in
`shared/src/domain.ts`.

```ts
const connectors = new ConnectorsService(
  {
    connectors: {
      xero: () => loadDatasetFromDisk(),
    },
  },
  deps,
);
```

## Message Flow

1. Receive `connectors.sync.request` with `orgId`, `connectorId`, and `traceId`.
2. Validate configuration and dataset integrity.
3. Emit `cdr.ingest` when successful, or an `audit.log` failure event otherwise.

## Telemetry

- `connectors.sync.success`
- `connectors.sync.failures`

## Testing

Integration coverage lives in `worker/test/workflow.test.ts`, which exercises
both the happy path and missing-connector error handling.
