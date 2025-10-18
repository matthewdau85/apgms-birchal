# HTTP API Reference

## API Gateway (`services/api-gateway`)

### GET `/health`
- Description: Returns service liveness.
- Authentication: None.
- Request: no parameters.
- Response 200 body schema:
```json
{
  "type": "object",
  "required": ["ok", "service"],
  "properties": {
    "ok": { "type": "boolean", "const": true },
    "service": { "type": "string", "const": "api-gateway" }
  }
}
```

### GET `/users`
- Description: Lists users with creation timestamps and organisation linkage.
- Authentication: None.
- Request query parameters: none.
- Response 200 body schema:
```json
{
  "type": "object",
  "required": ["users"],
  "properties": {
    "users": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["email", "orgId", "createdAt"],
        "properties": {
          "email": { "type": "string", "format": "email" },
          "orgId": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

### GET `/bank-lines`
- Description: Lists bank statement lines ordered by descending date.
- Authentication: None.
- Request query parameters:
  - `take` (optional, integer, min 1, max 200) — number of records to return; defaults to 20.
- Response 200 body schema:
```json
{
  "type": "object",
  "required": ["lines"],
  "properties": {
    "lines": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "orgId", "date", "amount", "payee", "desc", "createdAt"],
        "properties": {
          "id": { "type": "string" },
          "orgId": { "type": "string" },
          "date": { "type": "string", "format": "date-time" },
          "amount": { "type": "string" },
          "payee": { "type": "string" },
          "desc": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

### POST `/bank-lines`
- Description: Creates a bank statement line for the specified organisation.
- Authentication: None.
- Request body schema:
```json
{
  "type": "object",
  "required": ["orgId", "date", "amount", "payee", "desc"],
  "properties": {
    "orgId": { "type": "string" },
    "date": { "type": "string", "format": "date-time" },
    "amount": { "type": ["number", "string"] },
    "payee": { "type": "string" },
    "desc": { "type": "string" }
  }
}
```
- Responses:
  - 201 Created — returns the persisted bank line object (schema matches `GET /bank-lines` items).
  - 400 Bad Request — returns `{ "error": "bad_request" }` when validation or persistence fails.

## Tax Engine (`services/tax-engine`)

### GET `/health`
- Description: Returns service liveness.
- Authentication: None.
- Request: no parameters.
- Response 200 body schema:
```json
{
  "type": "object",
  "required": ["ok"],
  "properties": {
    "ok": { "type": "boolean", "const": true }
  }
}
```
