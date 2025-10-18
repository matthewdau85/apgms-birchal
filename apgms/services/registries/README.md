# Registries Service

The registries service materialises state updates required by statutory
registers such as ASIC and the Australian Business Register. It consumes
`registries.update` messages emitted by the reconciliation service.

## Responsibilities

- Validate that registry instructions target an allowed registry.
- Maintain an in-memory audit trail of registry updates per jurisdiction.
- Emit audit log entries that describe each applied change.

## Configuration

| Key                | Description                                 | Default        |
| ------------------ | ------------------------------------------- | -------------- |
| `allowedRegistries`| Array of registry identifiers permitted.    | `['asic','abr']` |

## Message Flow

1. Receive `registries.update` with the instruction payload.
2. Validate that the target registry is supported.
3. Append the update to the registry history.
4. Emit an `audit.log` entry for observability.

Unsupported registries raise an audit failure and are ignored.

## Telemetry

- `registries.update.success`
- `registries.update.failures`

## Testing

Registry behaviour is validated indirectly via the worker integration test,
which confirms that ASIC and ABR updates are written when reconciliation
completes.
