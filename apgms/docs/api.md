# API Gateway

## `GET /bank-lines`

List bank lines for an organisation in reverse chronological order.

### Query Parameters

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `orgId` | string | Yes | Organisation identifier to scope the results. |
| `cursor` | string | No | Opaque cursor returned by a previous request. |
| `limit` | integer | No | Maximum records to return (defaults to 20, capped at 200). |

### Response `200 OK`

```
{
  "bankLines": [
    {
      "id": "clv9z...",
      "orgId": "org_123",
      "date": "2024-01-02T00:00:00.000Z",
      "amountCents": 12345,
      "payee": "ACME Corp",
      "desc": "Fuel",
      "createdAt": "2024-01-02T01:02:03.456Z"
    }
  ],
  "nextCursor": "eyJpZCI6..." // Optional when more pages are available
}
```

- Results are ordered by `date` descending then `id` descending.
- `nextCursor` must be passed as `cursor` to fetch the next page.

### Error Responses

- `400` when validation fails (missing `orgId`, invalid cursor, invalid limit).

## `POST /bank-lines`

Create a bank line. Requests must include an `Idempotency-Key` header; repeated calls with the same key return `200 OK` and the original payload.

### Headers

| Name | Required | Description |
| ---- | -------- | ----------- |
| `Idempotency-Key` | Yes | Unique request key (string up to 255 characters). |

### Request Body

```
{
  "orgId": "org_123",
  "date": "2024-01-02T00:00:00.000Z",
  "amountCents": 12345,
  "payee": "ACME Corp",
  "desc": "Fuel"
}
```

### Responses

- `201 Created`
- `200 OK` when replayed with a known `Idempotency-Key`

```
{
  "bankLine": {
    "id": "idem-key-or-generated",
    "orgId": "org_123",
    "date": "2024-01-02T00:00:00.000Z",
    "amountCents": 12345,
    "payee": "ACME Corp",
    "desc": "Fuel",
    "createdAt": "2024-01-02T01:02:03.456Z"
  },
  "idempotencyReplayed": false
}
```

### Error Responses

- `400` when the request body fails validation or the `Idempotency-Key` header is missing/invalid.
