# BECS Remittance Adapter

## Sequence

```mermaid
sequenceDiagram
    participant Client
    participant API as API Gateway
    participant Adapter as BECS Adapter
    participant Store as TransferStore (Prisma)
    participant Rail as BECS Rail

    Client->>API: POST /remit/becs (requestId)
    API->>Adapter: createDebit(request)
    Adapter->>Store: findByRequestId
    alt Existing transfer
        Store-->>Adapter: Transfer (idempotent hit)
        Adapter-->>API: cached transfer state
    else New transfer
        Adapter->>Store: createTransfer
        Adapter->>Rail: createDebit (retry w/ backoff)
        Rail-->>Adapter: { externalId, status }
        Adapter->>Store: saveEvent + updateTransfer
        Adapter-->>API: transfer snapshot
    end

    API-->>Client: 200/202 { transfer, events }
```

## Environment variables

| Key | Description | Required | Default |
| --- | ----------- | -------- | ------- |
| `BECS_API_BASE_URL` | HTTPS endpoint for the upstream BECS provider | Yes (prod) | – |
| `BECS_API_KEY` | Bearer token used to authenticate to the BECS provider | Yes (prod) | – |
| `BECS_API_TIMEOUT_MS` | HTTP timeout (milliseconds) for BECS calls | No | `10000` |

In non-production environments the API gateway falls back to the in-memory `InMemoryBecsClient` when credentials are not supplied. Production deployments must provide the base URL and API key to reach the live rail.
