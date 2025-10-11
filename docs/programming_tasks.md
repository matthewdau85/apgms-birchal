# Programming Tasks for Compliance-Grade Launch

This backlog translates the Phase 2 delta prompts into actionable programming work packages. Each section lists the primary objectives, key deliverables, and initial technical subtasks required to progress the platform from prototype to partner-ready launch.

## 1. ATO Production Integrations
- **Objectives:** Deliver compliant BAS lodgement and STP Phase 2 submissions over live SBR channels.
- **Deliverables:**
  - `/services/sbr` service with configurable MTLS Soap/MTOM client and environment switching.
  - BAS lodge/amend endpoints persisting receipt metadata to audit trails.
  - STP Phase 2 pay event submitter with response handling and retry loops.
  - Conformance fixtures, redacted logging, and admin UI for certificate management.
- **Initial Tasks:** Scaffold service module, wire secure credential storage, generate schema mappers, add integration health checks, implement test harness.

## 2. DSP OSF Compliance Pack
- **Objectives:** Assemble documentation and automation required for DSP Operational Security Framework certification.
- **Deliverables:**
  - `/docs/dsp-osf/` with SDLC, change control, review SOP, dependency policies, background check templates.
  - Evidence index referencing CI logs, SBOMs, security scans, and secrets management artefacts.
  - GitHub Action publishing signed CycloneDX SBOMs per release.
- **Initial Tasks:** Draft policy templates, script SBOM generation, connect pipeline artefacts, configure signing keys, write contributor guidance.

## 3. ABR & ATO Registry Lookups
- **Objectives:** Replace mocked registry data with live ABN and GST/PAYGW status verification.
- **Deliverables:**
  - `/services/registries` module with throttled, cached ABR/ATO queries and consent logging.
  - Onboarding workflow updates storing lookup evidence.
  - Feature flags for sandbox versus production API keys.
- **Initial Tasks:** Define service interfaces, integrate HTTP clients with retry/backoff, persist consent artefacts, extend onboarding UI state management, add audit hooks.

## 4. Accounting Platform Connectors
- **Objectives:** Synchronise core accounting artefacts with external SaaS platforms.
- **Deliverables:**
  - `/services/connectors` adapters for Xero, MYOB, and QuickBooks with OAuth, token refresh, and webhook validation.
  - Background sync jobs for invoices, bills, and pay runs with conflict resolution strategies.
  - Settings UI updates for connection management and direction selection.
- **Initial Tasks:** Establish connector abstractions, configure OAuth apps and secrets storage, implement sync scheduling, design merge policies, add UI forms and state machines.

## 5. Live Payments Rails
- **Objectives:** Move from mocked rails to production-ready PayTo/PayID integrations with risk controls.
- **Deliverables:**
  - Real provider implementation of `IPaymentRail` with HMAC webhooks, replay defence, and rotation tooling.
  - Risk management rules (velocity caps, mandate pauses) and monitoring alerts.
  - PCI DSS scope statement documented in `/docs/security.md`.
- **Initial Tasks:** Evaluate provider SDKs, implement secure webhook ingestion, build mandate state machine, codify risk policies, update documentation.

## 6. Open Banking / CDR Connectivity
- **Objectives:** Provide bank feeds via the Consumer Data Right ecosystem.
- **Deliverables:**
  - `/services/cdr` handling data holder registry, consent, OAuth flows, and scheduled pulls.
  - Transaction normalisation into `recon.bank_txns` with mismatch flagging.
  - Reconciliation UI updates enabling bank connectivity management.
- **Initial Tasks:** Map CDR endpoints, generate consent screens, implement refresh schedulers, expand reconciliation logic, write UI tests for new flows.

## 7. Cryptography & Key Management
- **Objectives:** Harden sensitive data protection with envelope encryption and rotation.
- **Deliverables:**
  - KMS-backed master key abstraction with per-table DEKs and quarterly rotation process.
  - Key rotation CLI, re-encryption jobs, and audit logging with redaction policies.
- **Initial Tasks:** Select KMS provider, design key hierarchy, refactor storage models for encrypted fields, implement rotation pipeline, document recovery procedures.

## 8. Billing & Plans
- **Objectives:** Monetise the platform with subscription and usage-based billing.
- **Deliverables:**
  - Stripe integration with Starter/Growth/Pro plans, seat counts, and metered events.
  - Tax invoice generation with GST treatment and dunning automation.
  - Feature gating based on payment status with clear UX messaging.
- **Initial Tasks:** Configure Stripe products/webhooks, store billing state, enforce entitlements, design invoice templates, simulate edge cases in tests.

## 9. Performance Targets & Load Testing
- **Objectives:** Validate the system against defined SLOs and scalability benchmarks.
- **Deliverables:**
  - Performance budget (p95 latency, RPS, error budget) codified in documentation.
  - k6 load test suites for BAS compilation, reconciliation, and payment debits.
  - Autoscaling notes and queue-based back-pressure strategy.
- **Initial Tasks:** Document targets, author k6 scripts, add CI gating, analyse results, define autoscaling policies and metrics dashboards.

## 10. Threat, Privacy, and Incident Documentation
- **Objectives:** Provide comprehensive security governance artefacts.
- **Deliverables:**
  - `/docs/security/` housing STRIDE threat models, DFDs, DPIA, incident response playbooks, and tabletop checklists.
- **Initial Tasks:** Model service data flows, capture mitigations, author DPIA sections, draft incident runbooks, schedule tabletop exercises.

## 11. Accessibility & Tagged PDFs
- **Objectives:** Close manual accessibility gaps and ensure accessible exports.
- **Deliverables:**
  - Audit findings and remediation tasks for key screens.
  - Tagged PDF export pipeline with automated Playwright validation.
- **Initial Tasks:** Conduct manual audits, fix UI issues, retrofit PDF generator with semantic metadata, write automated tests, re-run PAC checks.

## 12. Interoperability & Hash Manifests
- **Objectives:** Support verifiable data exchange with third parties.
- **Deliverables:**
  - Canonical JSON/CSV schemas for BAS drafts, reconciliations, audit logs.
  - SHA-256 manifest generation displayed in Evidence tray.
- **Initial Tasks:** Define schemas, implement export serializers, compute manifests, update UI, add verification docs.

## 13. IP Governance
- **Objectives:** Safeguard proprietary knowledge while exposing public surfaces.
- **Deliverables:**
  - `/docs/ip/` with claim themes and disclosure control checklist.
  - Build-time guardrails marking INTERNAL code and linting TODOs that risk disclosure.
- **Initial Tasks:** Draft governance docs, annotate code paths, configure lint rules, add CI enforcement, brief engineering team.

## 14. Production IaC & Deployment Strategy
- **Objectives:** Codify repeatable, resilient production infrastructure.
- **Deliverables:**
  - Terraform/CDK stacks covering VPC, RDS with PITR, Redis, evidence object storage, and container orchestration.
  - Blue-green deployment automation, health checks, backup and DR runbooks.
- **Initial Tasks:** Choose IaC tooling, map resource topology, author modules, integrate with pipelines, script DR drills.

## 15. Data Residency & BYO Storage
- **Objectives:** Offer configurable data residency and customer-controlled storage.
- **Deliverables:**
  - Org-level residency policies, optional BYO S3 integrations, encryption assertions, export/deletion tooling, processor agreements template.
- **Initial Tasks:** Extend org schema, implement storage adapters, enforce residency routing, document compliance posture, expose admin controls.

## 16. AdminOps & Support Tooling
- **Objectives:** Equip support teams with safe administration capabilities.
- **Deliverables:**
  - Admin console for impersonation with safeguards, feature flags, support snapshots.
  - Ticketing system hooks (Linear/Jira) with redacted attachments.
- **Initial Tasks:** Build impersonation workflow with auditing, create snapshot serialization, integrate ticketing APIs, add admin UI components, harden permissions.

## 17. Extended Tax Surface
- **Objectives:** Prepare the data model for additional tax obligations.
- **Deliverables:**
  - Schema extensions for SGC, FBT, WET, LCT with placeholder calculators behind feature flags and hidden UI tabs.
- **Initial Tasks:** Design database migrations, stub calculation engines, wire feature flags, update API contracts, ensure backwards compatibility.

## 18. Governance Gates & Supply-Chain Security
- **Objectives:** Enforce release quality and supply-chain integrity.
- **Deliverables:**
  - Policy-as-code checks, SBOM verification, Trivy scans, release checklists, signed commits, branch protection, dependency update bot.
- **Initial Tasks:** Configure CI checks, define release templates, enable signed commits, script dependency update workflow, monitor supply-chain alerts.

---

Use this catalogue to populate the engineering roadmap, create epics in project tooling, and guide sequencing toward compliance-grade milestones.
