# Privacy Operations

## Administrative API Endpoints

- `POST /admin/privacy/export` (api-gateway)
  - Request body: `{ orgId: string, subjectEmail: string }`
  - Requires `x-admin-token` header matching `ADMIN_PRIVACY_TOKEN`.
  - Produces subject export artifact at `artifacts/privacy/<uuid>.json` with user + bank line payloads.

- `POST /admin/privacy/delete` (api-gateway)
  - Request body: `{ orgId: string, subjectEmail: string }`
  - Requires `x-admin-token` header matching `ADMIN_PRIVACY_TOKEN`.
  - Anonymizes the user, scrubs associated bank lines, and writes audit blob `artifacts/privacy/<uuid>-delete.json`.
