# AS4 Harness Test Evidence

Latest execution: 28 November 2024

```
PASS as4-harness
  ✓ publishes signed envelope (356 ms)
  ✓ validates receipt signature (141 ms)
  ✓ rejects replayed messageId (27 ms)
```

Test steps:

1. Generate a synthetic payment advice payload and enqueue it on the connector topic.
2. Assert that the AS4 connector signs the payload and records `AuditEvent` with action `as4.message.dispatch`.
3. Replay the same message ID and assert that the connector responds with HTTP 409 and emits `AuditEvent` tagged `replay_detected`.

Artifacts from the run (message envelope, receipt, connector logs) are stored under `docs/sbr/receipts/2024-11-28/`.
