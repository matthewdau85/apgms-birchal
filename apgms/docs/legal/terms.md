# Terms of Service

## Data Access and Portability
Authorized administrators can initiate complete account exports by calling the [`POST /admin/data/export`](../../services/api-gateway/src/index.ts) endpoint. Export packages are delivered through the secure admin channel and logged for audit purposes. Completed exports must be retained for 30 days to support dispute resolution.

## Data Deletion
Right-to-erasure requests are processed through the [`POST /admin/data/delete`](../../services/api-gateway/src/index.ts) endpoint. Administrators must confirm requester authority before submitting the deletion job and retain proof in the ticketing system. Deletion workflows also include dependent system scrubs managed by the platform SRE team.

## Incident Management
Any suspected privacy incident uncovered during export or deletion handling must follow the [Notifiable Data Breach runbook](../runbooks/ndb.md). The runbook documents triage, escalation, and reporting timelines under the Australian NDB scheme.
