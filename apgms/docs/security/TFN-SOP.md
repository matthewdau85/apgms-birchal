# Tax File Number Handling SOP

This standard operating procedure governs how Australian Tax File Number (TFN) data is collected, stored, and accessed across the Birchal platform.

## Collection

- TFNs are collected only through the secure onboarding flow. The front end enforces HTTPS and transmits TFNs directly to the API Gateway.
- The API validates TFN format, encrypts the value using AWS KMS (`alias/apgms-tfn`), and stores the ciphertext in the `registries` service.
- Staff must verify customer identity before requesting TFNs. Evidence is recorded in the CRM case file.

## Storage & Access

- Encrypted TFNs are never displayed in dashboards. Access is limited to the payroll reconciliation team and logged in `AuditEvent` with action `tfn.decrypt`.
- Decryption requests require an approved Jira ticket tagged `TFN-ACCESS`. The on-call security engineer reviews and approves the request in Opsgenie.
- All decrypted TFNs are redacted in logs. PII-safe hashes are used for correlation.

## Transmission

- TFNs are never emailed or exported in CSV. When transmitted to downstream partners (e.g. STP), payloads are signed and encrypted via AS4.
- Partners must sign the DSP Terms of Use and provide evidence of TFN handling controls before integration.

## Incident Response

- Suspected TFN exposure triggers the OAIC NDB playbook. Notify the privacy officer within 30 minutes and follow the communication templates in `docs/privacy/dpia.md`.
- Incidents are logged with severity `SEV-1` and require executive review.

## Review Cadence

This SOP is reviewed quarterly by Security and Legal to align with ATO DSP Operational Security Framework updates.
