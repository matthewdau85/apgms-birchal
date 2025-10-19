# Webhook Idempotency Test Evidence

**Test harness:** `pnpm --filter @apgms/api-gateway test:webhook`

The contract test exercises the webhook ingestion flow to confirm that duplicate payloads are rejected:

1. Generate a unique `Idempotency-Key` and POST a simulated payment webhook payload.
2. Assert the API returns `201 Created` and persists the payload.
3. Replay the exact payload with the same `Idempotency-Key`.
4. Expect `200 OK` with header `idempotency-replayed: true` and no duplicate side-effects.

Latest run (2024-12-02):

```
PASS webhook-idempotency
  ✓ first delivery accepted (211 ms)
  ✓ replayed delivery served from cache (12 ms)
```

All execution traces and Prisma query logs are stored in `logs/tests/webhook-idempotency/2024-12-02T083000Z.log` for auditors.
