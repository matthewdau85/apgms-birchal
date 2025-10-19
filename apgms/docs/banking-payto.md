# Banking integrations: Bank Linking & PayTo mandates

## Overview
This document outlines how to integrate with the banking consent and PayTo mandate APIs exposed by the API Gateway. It covers the consent lifecycle, mandate creation and fulfilment, webhook validation, and the sandbox flows available for partner testing.

## HTTP headers
All authenticated requests **must** include the following headers:

- `Authorization: Bearer <token>` — partners receive a sandbox token out of band. The default for local environments is `sandbox-token`.
- `X-Org-Id: <orgId>` — identifies the organisation that owns the consent or mandate. Requests scoped to a different organisation are rejected with `403`.
- `Content-Type: application/json` — required for POST requests with JSON payloads.
- `Idempotency-Key: <uuid>` (optional but recommended) — enables idempotent POST semantics. Replays return the cached response with `Idempotency-Replayed: true`.

Webhook requests **from** APGMS include:

- `X-Timestamp` — ISO-8601 timestamp when the event was emitted.
- `X-Nonce` — unique per delivery; replays within 5 minutes are rejected.
- `X-Signature` — lowercase hex HMAC-SHA256 of `<timestamp>.<nonce>.<body>` signed with your configured webhook secret.

## Consent lifecycle (textual sequence diagram)
```
Client -> API Gateway: POST /bank/consents { orgId, bank, accountRef }
API Gateway -> Prisma: create BankConnection(status=PENDING)
API Gateway -> PayTo Sandbox: createConsent()
API Gateway -> Client: 201 { id, status=PENDING, next.redirectUrl }
Client -> Bank Mock: complete consent journey
Bank Mock -> API Gateway: POST /webhooks/payto/consent (status=ACTIVE)
API Gateway -> Prisma: update BankConnection.status
API Gateway -> Prisma: create AuditBlob(bank_connection)
API Gateway -> Bank Mock: 200 { ok: true }
Client -> API Gateway: GET /bank/consents/:id -> status=ACTIVE
```

## Mandate lifecycle (textual sequence diagram)
```
Client -> API Gateway: POST /bank/mandates { orgId, bankConnectionId, reference, amountLimitCents }
API Gateway -> Prisma: create PayToMandate(status=PENDING)
API Gateway -> PayTo Sandbox: createMandate()
API Gateway -> Client: 201 { id, status=PENDING, nextEvent }
Sandbox Driver -> API Gateway: POST /webhooks/payto/mandate (status=ACTIVE)
API Gateway -> Prisma: update PayToMandate.status
API Gateway -> Prisma: create AuditBlob(mandate)
API Gateway -> Sandbox Driver: 200 { ok: true }
Client -> API Gateway: GET /bank/mandates/:id -> status=ACTIVE, latestEvent
```

## Webhook processing
1. Validate signature: compute `HMAC-SHA256(secret, "<timestamp>.<nonce>.<body>")` and compare with `X-Signature` using a constant-time check.
2. Enforce freshness: reject events older than five minutes from `X-Timestamp`.
3. Enforce uniqueness: store each `X-Nonce` in Redis for five minutes and reject replays (HTTP 409).
4. Upsert state: update the relevant `BankConnection` or `PayToMandate` status and write an `AuditBlob` row containing the raw payload.
5. Return `{ ok: true }` on success.

## Sandbox adapter flow
- `createConsent()` issues a sandbox consent identifier (`consent_<uuid>`) and returns a mock redirect URL and expiry.
- `createMandate()` issues `mandate_<uuid>` identifiers and exposes the next webhook payload via `nextEvent`.
- `simulateEvents()` lets you generate consent, mandate, or payment webhook payloads for local testing.
- `resetSandbox()` clears all in-memory state; tests call this between runs.

## Security controls
- HMAC signatures, nonce tracking, and 5-minute timestamp drift prevent tampering and replay attacks.
- All API mutations require bearer authentication and organisation-scoped headers; cross-org access is rejected.
- Idempotency caching leverages Redis to avoid duplicate consent or mandate creation when requests are retried.
- Webhook payloads are persisted in `AuditBlob` rows for auditability and replay analysis.
