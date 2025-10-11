# Phase 2 Delta Prompts

This document captures the scope gaps between the current prototype delivery and the extended roadmap, along with ready-to-run prompt packages to address each area.

## Covered Foundations

The existing prototype already includes:

- One-way accounts with RPT evidence tokens driving audit trails and gating.
- GST and PAYGW engines with versioned rules and an ingestion portal for administrators.
- Reconciliation pipelines for imports, scoring, exceptions, and payment rails mocks (PayTo/PayID), plus ABA export.
- Idempotency, row-level security, ASVS baseline, WCAG 2.2 AA scaffolding.
- Multi-service monorepo setup with CI, end-to-end tests, observability, privacy/retention controls, and UX flows for onboarding, BAS, reconciliation, payments, audit, and administration.

## Outstanding Gaps (Delta List)

The following capabilities remain outstanding for a compliance-ready, partner-grade launch:

1. ATO production integrations (SBR for BAS lodgement and STP Phase 2 for payroll) — current solution uses mocks.
2. DSP OSF compliance documentation and evidence pack.
3. ABR/ATO lookup services with live endpoints, throttling, caching, and consent tracking.
4. Accounting platform integrations (Xero, MYOB, QuickBooks) with sync and conflict resolution.
5. Production payments rails (live PayTo/PayID adapters) and PCI DSS scope notes.
6. Open Banking/CDR connectivity for bank feeds.
7. Advanced cryptography and key management (KMS, envelope encryption, rotation procedures).
8. Business model and billing setup (plans, metering, invoicing, GST on fees).
9. Capacity targets, service-level objectives, and performance testing.
10. Security documentation, including threat models, DPIA, incident response, and disaster recovery drills.
11. Manual accessibility audit coverage and tagged PDF exports.
12. Interoperable export formats and cryptographic hash manifests.
13. Patent and trade-secret governance safeguards.
14. Production deployment infrastructure-as-code, backups, and rollout strategies.
15. Data residency, tenancy isolation options, and BYO storage support.
16. Support and admin operations tooling (impersonation, ticketing hooks, runbooks).
17. Extended tax surface scaffolding (SGC, FBT, WET, LCT).
18. Governance and QA gates (policy-as-code, SBOMs, Trivy, release checklists).

## Prompt Packages

Each block below is designed for direct use when expanding the system. Apply them selectively based on the phase of delivery.

### ATO SBR & STP Phase 2 Integrations
```
Add production-ready ATO integrations:
- Implement SBR client: create /services/sbr with Soap+MTOM or vendor SDK abstraction; config for test vs prod endpoints; MTLS using client certs from a secure store; message signing; correlation IDs.
- BAS lodgement flow: build /sbr/bas/lodge and /sbr/bas/amend; map our BAS draft to SBR schemas; handle validation & business exceptions; persist SBR receipt numbers and message logs in audit.
- STP Phase 2: generate Pay Event payloads from paygw.pay_events; mock first, then real submit; handle ATO responses, fix-up cycles, and deferrals.
- Provide conformance tests, replayable fixtures, and redaction for logs.
- Update Admin ▸ Integrations with SBR cert upload, environment toggle, and health check.
```

### DSP OSF Compliance Pack
```
Create /docs/dsp-osf/ with:
- Secure SDLC policy, change control, code review SOP, dependency management, SBOM generation (CycloneDX), vulnerability mgmt.
- Personnel/role matrix, background checks policy template.
- PenTest readiness checklist + sample scope.
- Evidence index linking CI logs, SBOMs, SAST/DAST reports, secrets mgmt docs.
- Add a GitHub Action to produce signed SBOMs and attach to releases.
```

### ABR & ATO Registry Lookups
```
Implement ABR/ATO lookups service:
- /services/registries with ABN lookup and GST/PAYGW registration status queries; add caching with TTL, exponential backoff, and consent logging per org.
- Onboarding step 2 to call these live endpoints; store proofs in audit.evidence.
- Feature flags for sandbox vs prod keys.
```

### Accounting Platform Connectors
```
Add /services/connectors with Xero/MYOB/QBO adapters:
- OAuth flows, token storage/refresh, webhooks verification.
- Sync jobs for invoices/bills/payruns; conflict policy (last-writer-wins vs merge prompt).
- UI: Settings ▸ Integrations to connect and choose sync directions.
```

### Live Payments Rails
```
Abstract IPaymentRail to add a real PayTo provider:
- Add HMAC-signed webhooks, webhook rotation, replay protection.
- Risk rules: limit schedules, velocity caps, 3-strike mandate pause.
- PCI DSS scope statement (even if out of scope), store in /docs/security.md.
```

### Open Banking / CDR
```
Introduce /services/cdr:
- Data holder registry fetch; OAuth + consent screens; bank account read scopes; scheduled pulls.
- Normalise transactions to recon.bank_txns; flag mismatches vs CSV imports.
- UI: Reconciliation ▸ Connect a bank (CDR).
```

### Cryptography, Keys, and Rotation
```
Add envelope encryption for TFN and sensitive fields using a KMS abstraction:
- Keys: master (KMS) + DEKs per table; rotate DEKs quarterly; re-encrypt job.
- Provide key rotation CLI and disaster recovery procedures; log all key ops to audit with redaction.
```

### Billing & Plans
```
Add Stripe billing:
- Plans: Starter, Growth, Pro; seat-based; metered events (reconciles, lodgements).
- Tax invoices with your ABN and GST rules.
- Dunning webhooks, grace periods; lock features on non-payment with clear UI.
```

### Performance Targets & Load Testing
```
Set explicit targets:
- API p95 < 250ms, 500 RPS sustained, 0.1% error budget/month.
- Create k6 load tests for BAS compile, recon match, payments debit.
- Add autoscaling notes and back-pressure strategy with queues.
```

### Threat Model, DPIA, and Incident Response
```
Author /docs/security/*:
- STRIDE diagram per service; DFDs and mitigations.
- DPIA covering TFN handling and bank data; link to lawful basis and retention controls.
- Incident response: triage levels, comms templates, regulator notification timelines.
- Quarterly tabletop checklist.
```

### Accessibility & Tagged PDFs
```
Run manual a11y audit on key screens; fix findings.
Ensure exported PDFs are properly tagged (headings, tables, alt text) and pass PAC checks; add a Playwright PDF tag test.
```

### Interoperability & Hash Manifests
```
Define canonical JSON/CSV export schemas for BAS drafts, reconciliations, and audit logs. Generate a SHA-256 manifest per export and show it in the Evidence tray for third-party verification.
```

### Patent & Trade-Secret Guardrails
```
Insert developer guardrails:
- “Public surface” comments only; sensitive internals labeled INTERNAL and excluded from builds via tree-shaking.
- Create /docs/ip/ with claim themes and disclosure control checklist; add a linter rule that blocks TODOs revealing algorithms in public bundles.
```

### Production Deployment (IaC)
```
Add IaC (Terraform or CDK) for:
- VPC, RDS Postgres with PITR, Redis, object storage for evidence, container orchestrator (ECS/EKS/Fly.io).
- Blue-green deploys, health checks, rollbacks.
- Backups + restore runbook; scheduled DR drill script.
```

### Data Residency & BYO Storage
```
Implement org-level data store policy:
- Choose region/residency, optional BYO S3 bucket.
- Encrypt-at-rest policy assertions; export/delete tools per org; processor agreements template.
```

### AdminOps & Support Tooling
```
Build Admin Console:
- Safe user impersonation (with banners + auto-logout), feature flags, and support snapshots.
- Ticketing hooks (e.g., Linear/Jira) with redacted context attachments.
```

### Extended Tax Surface
```
Extend schema with SGC/FBT/WET/LCT tables and placeholder calculators behind feature flags to future-proof data model and UI tabs (hidden by default).
```

### Governance Gates & Supply-Chain Security
```
Add release gates:
- Required reviews, signed commits, branch protection, Trivy and sbom-verify as PR checks.
- Weekly dependency update bot with auto-PRs + staged rollouts.
```

## Phase Guidance

- **Prototype / Alpha**: Existing scope suffices for customer demos and early pilots.
- **Compliance-grade / Partner-ready**: Prioritize SBR/STP integrations, DSP OSF documentation, hardened key management, and IaC for production environments.
- **Investor / Enterprise-ready**: Layer on billing, CDR connectivity, accounting connectors, and governance controls for scale and due diligence readiness.

