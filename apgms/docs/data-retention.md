# Data Retention & PII Handling

This document captures Birchal's policies for retaining data, classifying personally identifiable information (PII), and ensuring sensitive fields never leak into application logs.

## Retention Durations

| Data class | Examples | Retention policy |
| ---------- | -------- | ---------------- |
| **Product analytics (aggregated)** | Feature usage metrics, event counts | Retain for 24 months. Historical trends beyond two years are archived to cold storage without identifiers. |
| **Operational records** | Bank lines, investment transactions, portfolio valuations | Retain for 7 years to satisfy financial services obligations. After 7 years data is anonymised and aggregated. |
| **Customer support artefacts** | Zendesk conversations, resolution notes | Retain for 24 months after ticket close, then delete unless a legal hold applies. |
| **Audit logs** | Authentication events, admin configuration changes | Retain raw events for 18 months, then keep an anonymised aggregate for fraud analytics. |
| **Infrastructure telemetry** | Application metrics, uptime pings | Retain in hot storage for 90 days and aggregate beyond that horizon. |

## PII Classification

PII is categorised into three sensitivity tiers:

- **Tier 1 – Direct identifiers**: Email addresses, legal names, phone numbers, government IDs, bank account numbers. These fields are encrypted at rest and redacted from all logs and analytics exports.
- **Tier 2 – Quasi identifiers**: IP addresses, device identifiers, session IDs. Accessible only to authorised operations personnel and redacted from shared dashboards.
- **Tier 3 – Derived identifiers**: Behavioural segments, scoring outputs. Stored separately from direct identifiers and expunged upon account deletion.

All application code must treat Tier 1 & 2 data as confidential and avoid emitting it to stdout/stderr or third-party tools without explicit approval.

## Log Redaction Policy

- Application services MUST use the shared logger configuration which redacts request/response headers, bodies, database connection strings, tokens, and any fields matching `*email`, `*password`, or `*token`.
- Any diagnostic logging of environment configuration must only report boolean flags or masked identifiers. Secrets such as `DATABASE_URL`, API keys, or session cookies are never printed.
- Automated tests assert that logger output replaces sensitive values with `[REDACTED]` so regressions are caught in CI.
- When ad-hoc debugging requires additional context, engineers must add temporary logs that mask PII and remove them before merging code.

Adherence to these practices ensures we remain compliant with privacy regulations while still retaining the observability needed to operate the platform safely.
