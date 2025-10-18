# Audit Service

The audit service consumes `audit.log` messages from the shared message bus and
persists a rolling window of audit entries for downstream observability. It is
stateless aside from its in-memory buffer and is safe to run in multiple
instances behind the same queue.

## Responsibilities

- Record every `audit.log` envelope emitted by the other services.
- Enforce a configurable retention limit so the buffer cannot grow unbounded.
- Emit telemetry counters for successful and failed log writes.

## Configuration

| Key          | Description                                 | Default |
| ------------ | ------------------------------------------- | ------- |
| `retention`  | Maximum number of audit records to retain.  | `1000`  |

Configuration is injected when the service class is instantiated:

```ts
const audit = new AuditService({ retention: 500 }, deps);
```

## Message Contracts

The service expects the shared `audit.log` contract defined in
`shared/src/messaging.ts`. Each envelope must include:

- `traceId` – correlates the event with its workflow.
- `action` and `entity` – human readable identifiers.
- `status` – `SUCCESS` or `FAILURE`.

## Telemetry

Counters are exposed via the shared telemetry instance using the key
`audit.log.success`.

## Testing

The worker integration tests (`worker/test/workflow.test.ts`) assert that audit
entries are written for both the happy path and failure scenarios.
