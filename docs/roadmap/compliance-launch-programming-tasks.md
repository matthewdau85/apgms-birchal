# Compliance-Grade Launch Programming Tasks

This roadmap decomposes the compliance launch backlog into discrete engineering tasks that can be scheduled across teams. Each epic lists the user value, acceptance criteria, and implementation checklist items to guide execution.

## 1. ATO Production Integrations
- **User value:** Lodging BAS and STP submissions against the live SBR gateway with auditable outcomes.
- **Acceptance criteria:**
  - BAS lodge and amend endpoints call SBR services with environment toggles, persisting receipt metadata.
  - STP Phase 2 pay events submit successfully with retries, and negative cases surface actionable errors.
  - Admins can manage SBR certificates without exposing secrets in logs.
- **Implementation tasks:**
  1. Scaffold `/services/sbr` module with configuration loading, MTLS Soap/MTOM client, and sandbox/production switching.
  2. Generate BAS and STP schema mappers from SBR XSDs; add conformance fixtures to regression suite.
  3. Persist submission receipts, payload hashes, and acknowledgements in audit tables with redacted logging.
  4. Build STP pay event submitter with retry/backoff loops and response handling for edge cases.
  5. Wire certificate vaulting, rotation alerts, and integration health checks; expose management UI.
  6. Deliver end-to-end test harness hitting SBR test endpoints.

## 2. DSP OSF Compliance Pack
- **User value:** Demonstrating operational security maturity for DSP certification.
- **Acceptance criteria:**
  - Policies and procedures are published in `/docs/dsp-osf/` and referenced from onboarding materials.
  - Evidence index links automated artefacts (CI logs, SBOMs, scans, secrets inventory).
  - CI builds produce signed CycloneDX SBOMs per release branch/tag.
- **Implementation tasks:**
  1. Draft SDLC, change control, dependency, review, and background check policy templates.
  2. Script SBOM generation via pnpm and CycloneDX; store outputs as build artefacts.
  3. Configure key material and signing workflow for SBOM attestation.
  4. Assemble evidence index markdown linking CI artefacts and secrets management proofs.
  5. Document contributor guidance for maintaining compliance pack.
  6. Add GitHub Action workflow enforcing SBOM publication on release.

## 3. ABR & ATO Registry Lookups
- **User value:** Automatically verifying business registrations during onboarding.
- **Acceptance criteria:**
  - Registry lookups throttle and cache results, persisting consent artefacts.
  - Onboarding flows store verification evidence and surface feature flag-controlled environments.
- **Implementation tasks:**
  1. Define `/services/registries` interfaces and HTTP clients with retry/backoff.
  2. Implement ABR and ATO integration adapters with configurable API keys and consent logging.
  3. Add caching layer and quota protection around registry calls.
  4. Update onboarding workflow to store lookup evidence and display statuses.
  5. Introduce feature flags for sandbox/production keys and add audit hooks.
  6. Expand tests covering throttling, caching, and consent persistence.

## 4. Accounting Platform Connectors
- **User value:** Synchronising accounting data with partner SaaS systems.
- **Acceptance criteria:**
  - OAuth flows support Xero, MYOB, QuickBooks with refresh and webhook validation.
  - Background sync jobs reconcile invoices, bills, pay runs, resolving conflicts.
  - Users can control sync directionality via settings UI.
- **Implementation tasks:**
  1. Establish connector abstraction layer in `/services/connectors` with shared OAuth tooling.
  2. Configure OAuth apps and secure storage for client secrets and refresh tokens.
  3. Implement provider-specific adapters, webhook handlers, and signature verification.
  4. Schedule background sync jobs with dedupe/conflict resolution policies.
  5. Extend settings UI with connection management flows and state machines.
  6. Add integration tests for sync pipelines and webhook ingestion.

## 5. Live Payments Rails
- **User value:** Executing PayTo/PayID transactions with production-grade security and monitoring.
- **Acceptance criteria:**
  - `IPaymentRail` provider handles real provider API, HMAC webhooks, and replay defence.
  - Risk rules enforce velocity caps, mandate pauses, and alerting.
  - PCI DSS scope statement documented.
- **Implementation tasks:**
  1. Select provider SDKs, model mandate state machine, and integrate secure webhook ingestion.
  2. Implement HMAC validation, replay protection, and secret rotation tooling.
  3. Codify risk policies with monitoring dashboards and alert hooks.
  4. Update payment flows to consume real rails and surface mandate states.
  5. Document PCI DSS scope and compensating controls in `/docs/security.md`.
  6. Add automated tests covering webhook security and risk rule enforcement.

## 6. Open Banking / CDR Connectivity
- **User value:** Providing compliant bank feeds through CDR data holders.
- **Acceptance criteria:**
  - `/services/cdr` manages registry discovery, consent, OAuth, and scheduled pulls.
  - Transactions normalise into `recon.bank_txns` with mismatch flagging.
  - UI enables customers to manage bank connectivity.
- **Implementation tasks:**
  1. Map CDR data holder registry endpoints and generate consent screens.
  2. Build OAuth/consent flows with refresh scheduling and revocation handling.
  3. Implement data pull workers normalising bank transactions and flagging mismatches.
  4. Extend reconciliation UI with connectivity management and status indicators.
  5. Add automated UI tests validating new flows; update reconciliation logic for mismatches.
  6. Instrument logging and audit trails for consent lifecycle.

## 7. Cryptography & Key Management
- **User value:** Protecting sensitive data with envelope encryption and rotation.
- **Acceptance criteria:**
  - KMS-backed master keys issue per-table data encryption keys (DEKs) with rotation.
  - CLI and jobs support re-encryption and auditing.
- **Implementation tasks:**
  1. Select KMS provider and design key hierarchy diagrams.
  2. Refactor storage models to support encrypted fields and metadata tracking.
  3. Implement master key abstraction with per-table DEK issuance and caching.
  4. Build rotation CLI, background re-encryption jobs, and audit logging.
  5. Draft redaction policies and recovery procedures documentation.
  6. Add unit/integration tests for encryption lifecycle and rotation events.

## 8. Billing & Plans
- **User value:** Monetising platform usage with Stripe plans and metering.
- **Acceptance criteria:**
  - Stripe integration supports plan tiers, seat counts, and metered usage.
  - Invoices apply GST treatment and trigger dunning automation.
  - Feature gating enforces entitlements with UX messaging.
- **Implementation tasks:**
  1. Configure Stripe products, prices, and webhook endpoints; secure secret storage.
  2. Model billing state in backend, including seat counts and usage metrics.
  3. Generate tax invoices with GST logic and email delivery.
  4. Implement dunning workflows and notification templates.
  5. Enforce entitlements in application services and surface UX gating messages.
  6. Simulate edge cases in automated tests (failed payments, plan changes).

## 9. Performance Targets & Load Testing
- **User value:** Ensuring platform meets defined SLOs under load.
- **Acceptance criteria:**
  - Performance budget documented; k6 suites exercise BAS, reconciliation, payment flows.
  - Autoscaling and back-pressure strategies defined.
- **Implementation tasks:**
  1. Document latency and error budgets in performance guide.
  2. Author k6 scripts for BAS compilation, reconciliation, payment debits.
  3. Integrate load tests into CI with gating thresholds.
  4. Analyse results, log bottlenecks, and document remediation backlog.
  5. Draft autoscaling policy notes and queue-based back-pressure design.
  6. Instrument metrics dashboards to monitor SLOs.

## 10. Threat, Privacy, and Incident Documentation
- **User value:** Providing comprehensive security governance artefacts for stakeholders.
- **Acceptance criteria:**
  - `/docs/security/` contains STRIDE threat models, DFDs, DPIA, and incident playbooks.
  - Tabletop exercises and mitigations are documented.
- **Implementation tasks:**
  1. Model service data flows and produce diagrams.
  2. Author STRIDE threat analysis with mitigations per component.
  3. Draft DPIA covering data types, purposes, and protections.
  4. Write incident response runbooks and tabletop checklists.
  5. Schedule tabletop exercises and capture lessons learned.
  6. Review and sign off artefacts with security stakeholders.

## 11. Accessibility & Tagged PDFs
- **User value:** Ensuring accessible experiences and exports.
- **Acceptance criteria:**
  - Audit findings tracked and remediated for key screens.
  - PDFs include tags validated with Playwright and PAC checks.
- **Implementation tasks:**
  1. Conduct manual accessibility audits; log issues and assign owners.
  2. Remediate UI gaps (ARIA, focus order, contrast) and add regression tests.
  3. Retrofit PDF generator with semantic tagging metadata.
  4. Automate PDF validation via Playwright flows.
  5. Re-run PAC checks and capture evidence artefacts.
  6. Document accessibility remediation status.

## 12. Interoperability & Hash Manifests
- **User value:** Enabling verifiable data exchange with partners.
- **Acceptance criteria:**
  - Canonical schemas published and exports include SHA-256 manifests visible in Evidence tray.
- **Implementation tasks:**
  1. Define JSON/CSV schemas for BAS drafts, reconciliations, audit logs.
  2. Implement export serializers emitting canonical formats.
  3. Compute SHA-256 manifests during export and persist for verification.
  4. Update Evidence tray UI to display manifests and verification status.
  5. Document verification workflow for partners.
  6. Add automated checks ensuring schema compatibility.

## 13. IP Governance
- **User value:** Protecting proprietary knowledge while enabling collaboration.
- **Acceptance criteria:**
  - `/docs/ip/` hosts governance policies and disclosure controls.
  - Build-time guardrails highlight internal code and risky TODOs.
- **Implementation tasks:**
  1. Draft claim themes, disclosure control checklist, and sharing guidelines.
  2. Annotate internal code paths with markers consumed by guardrail tooling.
  3. Configure lint rules to flag risky TODOs or disclosures.
  4. Add CI enforcement and documentation for engineers.
  5. Train teams on IP governance responsibilities.
  6. Review policies with legal stakeholders.

## 14. Production IaC & Deployment Strategy
- **User value:** Repeatable, resilient production infrastructure.
- **Acceptance criteria:**
  - Terraform/CDK stacks provision VPC, RDS with PITR, Redis, object storage, and container orchestration.
  - Blue-green deployments, health checks, and DR runbooks documented.
- **Implementation tasks:**
  1. Select IaC tooling and codify base networking modules.
  2. Model database, cache, and storage resources with security baselines.
  3. Implement container orchestration stack and deployment automation.
  4. Add blue-green rollout scripts with health/rollback checks.
  5. Document backup, DR, and runbook procedures.
  6. Integrate IaC pipeline with security scanning and approvals.

## 15. Data Residency & BYO Storage
- **User value:** Supporting customer residency requirements and BYO storage.
- **Acceptance criteria:**
  - Org-level residency policies enforced; optional BYO S3 integrations available.
  - Encryption assertions and export/deletion tooling documented.
- **Implementation tasks:**
  1. Extend organisation schema with residency settings and enforcement hooks.
  2. Implement storage adapters for platform-managed and BYO S3 buckets.
  3. Route data storage and processing based on residency policies.
  4. Build admin controls for configuring residency and storage options.
  5. Document compliance posture and processor agreements template.
  6. Provide export/deletion tooling with audit trails.

## 16. AdminOps & Support Tooling
- **User value:** Equipping support teams with safe administration capabilities.
- **Acceptance criteria:**
  - Admin console supports impersonation with safeguards, feature flag toggles, and support snapshots.
  - Ticketing integrations redact sensitive attachments.
- **Implementation tasks:**
  1. Build impersonation workflows with approval and audit logging.
  2. Implement feature flag management UI and role-based access controls.
  3. Create support snapshot serialization and download flow.
  4. Integrate Linear/Jira ticketing APIs with redaction utilities.
  5. Harden admin permissions and monitoring.
  6. Add tests for admin workflows and ticketing hooks.

## 17. Extended Tax Surface
- **User value:** Preparing models for additional tax obligations.
- **Acceptance criteria:**
  - Schema extensions cover SGC, FBT, WET, LCT; calculators behind feature flags.
  - API and UI changes maintain backwards compatibility.
- **Implementation tasks:**
  1. Design database migrations and models for new tax types.
  2. Stub calculation engines and register feature flags.
  3. Update APIs and documentation while keeping existing behaviour stable.
  4. Hide UI tabs until features are enabled; add integration tests.
  5. Ensure migrations include rollback plans and data validation.
  6. Capture stakeholder sign-off on readiness.

## 18. Governance Gates & Supply-Chain Security
- **User value:** Enforcing release quality and supply-chain integrity.
- **Acceptance criteria:**
  - Policy-as-code checks, vulnerability scans, signed commits, and release checklists operate in CI/CD.
  - Dependency update bot maintains third-party libraries.
- **Implementation tasks:**
  1. Configure policy-as-code tooling (OPA/Conftest) across pipelines.
  2. Enable Trivy and SBOM verification in CI.
  3. Require signed commits and branch protection updates.
  4. Draft release checklist templates with approvals and verification steps.
  5. Implement dependency update automation (Renovate/Dependabot) with security review gates.
  6. Monitor supply-chain alerts and document response workflows.

