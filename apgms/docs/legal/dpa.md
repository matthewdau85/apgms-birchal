# Data Processing Agreement

## Sub-processor Oversight
Customer data exports initiated through the [`POST /admin/data/export`](../../services/api-gateway/src/index.ts) endpoint are restricted to contracted sub-processors and logged for transparency. Partners receiving export data must comply with encryption-at-rest and transit controls defined in this agreement.

## Data Deletion Assistance
We provide verifiable deletion support for controllers using the [`POST /admin/data/delete`](../../services/api-gateway/src/index.ts) endpoint. Completed deletions generate attestations that controllers may furnish to auditors on request.

## Breach Cooperation
In the event that export or deletion activities expose a notifiable incident, both parties will adhere to the [NDB runbook](../runbooks/ndb.md) for coordinated investigation, notification, and remediation.
