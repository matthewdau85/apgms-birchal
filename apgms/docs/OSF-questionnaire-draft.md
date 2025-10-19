# DSP OSF security questionnaire (draft)

_Last updated: 2025-01-14_

The following responses describe how the APGMS platform satisfies the controls that
typically appear in the Open Security Foundation (OSF) due diligence questionnaire.
Each answer references supporting evidence already committed to this repository so
reviewers can trace statements back to primary artifacts.

## 1. Governance and security program

| Question | Response | Evidence |
| --- | --- | --- |
| Do you maintain an information security program with executive sponsorship? | Yes. The security program is owned by the CTO and follows the guardrails described in the security playbooks. | [Security guardrails](./security/TFN-SOP.md) |
| Are formal security policies and standards documented and reviewed annually? | Draft policies covering authentication, logging and data handling are versioned in Git and scheduled for quarterly review via the ops runbook. | [Ops runbook](./ops/runbook.md) |
| How do you track and mitigate product and compliance risks? | A living risk register tracks impact, likelihood, owners and treatments for each identified risk. | [Risk register](./risk/register.md) |
| Is there a consolidated evidence catalogue for audits? | Yes, evidence is indexed with pointers to privacy, legal and architectural documentation. | [Evidence index](./evidence-index.md) |

## 2. Application security

| Question | Response | Evidence |
| --- | --- | --- |
| Do you follow a secure SDLC with threat modelling and design reviews? | Architectural decisions are documented with C4 models, and new services must document trust boundaries before implementation. | [Architecture overview](./architecture.md) |
| How do you verify security requirements during development? | We map requirements to OWASP ASVS L2 and track automated coverage status per control. | [ASVS control map](./ASVS-control-map.csv) |
| Are automated tests in place for critical services? | The API gateway includes regression and health tests that run with `pnpm -r test`, and load tests validate the debit posting path. | [API Gateway tests](../services/api-gateway/test) · [K6 debit path](../k6/debit-path.js) |
| How are secrets and configuration managed? | Secrets are injected via environment variables resolved by the Fastify bootstrap; the repo does not store credentials. | [API gateway bootstrap](../services/api-gateway/src/index.ts) |

## 3. Infrastructure and operations

| Question | Response | Evidence |
| --- | --- | --- |
| Describe your hosting model and environment segregation. | Infrastructure-as-code modules provision isolated app, database and network stacks per environment, with Terraform variables controlling segmentation. | [IaC modules](../infra/iac) |
| Do you maintain observability for critical services? | Grafana dashboards and alerting definitions are tracked in Git to ensure parity across environments. | [Observability dashboards](../infra/observability/grafana/dashboards.json) |
| How are deployments orchestrated and rolled back? | Operational runbooks define deployment, rollback and break-glass procedures for the platform team. | [Ops runbook](./ops/runbook.md) |
| Are third-party integrations assessed prior to onboarding? | Partner vetting artefacts document diligence performed for banking and registry integrations. | [Bank partner packet](./partners/bank-packet.md) |

## 4. Data protection and privacy

| Question | Response | Evidence |
| --- | --- | --- |
| Do you classify and inventory personal data? | The DPIA enumerates data categories, flows and lawful bases for processing. | [DPIA](./privacy/dpia.md) |
| How do you satisfy customer data requests and deletion? | Privacy policy drafts detail subject access, rectification, and deletion SLAs handled via the support queue. | [Privacy policy](./legal/Privacy-Policy-draft.md) |
| Is encryption enforced in transit and at rest? | All service-to-database communications use Prisma with TLS-enabled connection strings; infrastructure modules mandate managed database encryption. | [Database module](../infra/iac/modules/database) |
| Where do you document data sharing with subprocessors? | Contracts and ToS drafts enumerate subprocessors, escrow, and termination obligations. | [Terms of Service](./legal/ToS-draft.md) |

## 5. Incident response and business continuity

| Question | Response | Evidence |
| --- | --- | --- |
| Do you maintain an incident response plan with RACI assignments? | The TFN Security SOP defines severity levels, communications, and role assignments for incident handling. | [TFN SOP](./security/TFN-SOP.md) |
| What are your notification timelines for security incidents? | Within 24 hours for high severity incidents, as documented in the SOP and reinforced via the ops runbook escalation matrix. | [Ops runbook](./ops/runbook.md) |
| How is business continuity tested? | The runbook mandates quarterly game days including failover tests using the K6 debit path scenario to validate critical workflows. | [K6 debit path](../k6/debit-path.js) |
| Do you have a customer communication plan post-incident? | The customer success playbooks outline messaging templates and approval workflows for post-incident updates. | [Customer success playbooks](./success/playbooks.md) |

## 6. Compliance and attestations

| Question | Response | Evidence |
| --- | --- | --- |
| Which regulatory frameworks influence your control set? | We align with DSP OSF, OWASP ASVS L2 and Australian financial record-keeping requirements. | [ASVS mapping](./ASVS-control-map.csv) |
| Do you collect attestations from subprocessors? | Partner packets include completed questionnaires and contractual commitments from regulated partners. | [Partner packet](./partners/bank-packet.md) |
| How do you review compliance drift? | The evidence index is reviewed monthly during security council meetings to ensure documents remain current. | [Evidence index](./evidence-index.md) |

> **Next steps:** Finalise outstanding `FAIL` controls in the ASVS map and expand automated test coverage prior to external submission.
