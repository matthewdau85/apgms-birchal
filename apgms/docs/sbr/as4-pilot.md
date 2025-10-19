# SBR AS4 Pilot Evidence

We have not yet selected the production AS4 messaging vendor. During the pilot we exercise the end-to-end workflow against the Australian Tax Office test harness using the following artefacts:

- **Message captures:** Each outbound AS4 message produces a signed envelope archived in `s3://apgms-compliance/as4-pilot/`. Filenames follow `YYYYMMDD-HHMMSS-<messageId>.xml`.
- **Receipts:** Simulated ATO receipts are stored as JSON in this repository under `docs/sbr/receipts/`. They include message ID, correlation ID, and signature fingerprint.
- **Test harness logs:** The integration test runner emits structured logs in [`tests/contract/as4-harness.md`](../../tests/contract/as4-harness.md) verifying replay protection and receipt validation.

## Pilot workflow

1. API Gateway creates a payment advice and publishes a message to the AS4 connector queue.
2. The connector signs the payload using the dedicated client certificate stored in AWS Secrets Manager.
3. Simulated ATO responds with a receipt; the connector validates the signature and persists metadata for audit.
4. Both message and receipt identifiers are written to the `AuditEvent` table (`action = 'as4.message.dispatch'`).

## Next steps before go-live

- Finalise vendor selection between LinkSafe and MessageXchange.
- Replace simulated receipts with production receipts and attach them here.
- Complete interoperability testing with the ATO certification team (ticket `AS4-112`).
