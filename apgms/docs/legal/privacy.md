# Privacy Policy

## Individual Rights Management
We honour access and portability rights by exposing the [`POST /admin/data/export`](../../services/api-gateway/src/index.ts) endpoint to tenant administrators. Each export request is authenticated with admin credentials, recorded in the privacy register, and delivered through encrypted channels within seven days.

## Erasure Requests
Deletion requests are orchestrated via the [`POST /admin/data/delete`](../../services/api-gateway/src/index.ts) endpoint. Successful completion triggers downstream purge tasks and confirmation notices to the requester. Audit logs of deletion events are retained for compliance validation.

## Notifiable Data Breach (NDB) Alignment
If an export or deletion flow reveals unauthorised disclosure, the incident response must follow the [NDB runbook](../runbooks/ndb.md). The runbook enumerates containment steps, regulator notifications, and customer communications required under the Australian Privacy Act.
