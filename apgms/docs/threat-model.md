# Threat Model

## System Components
- **Web Client (webapp/)**: React-based single-page application providing investor dashboards and offer interactions.
- **API Gateway (services/api/)**: Node.js service exposing REST/GraphQL endpoints for account management, offer data, and transaction processing.
- **Worker Services (worker/)**: Background processors handling asynchronous jobs such as document generation, notifications, and reconciliation.
- **Shared Services (shared/)**: Common libraries for domain logic, validation, and messaging that are consumed by multiple runtime components.
- **Data Platform (infra/postgres, infra/redis)**: Managed PostgreSQL for persistence and Redis for caching and job queues.
- **Identity and Access Management**: External identity provider integrating via OAuth/OpenID Connect, enforcing MFA for operator access.
- **Observability Stack (infra/monitoring)**: Centralized logging, metrics, and alerting through managed services.

## Trust Boundaries and Data Flows
- Browser clients communicate with the API Gateway over TLS 1.2+, authenticated via OAuth access tokens.
- Internal services communicate on a private network segment with mutual TLS enforced by the service mesh.
- Workers consume messages from queues hosted within the same private network and interact with the database using scoped credentials.
- Administrative operators connect through a hardened bastion with context-aware access policies before reaching internal tooling.

## STRIDE Analysis by Asset
| Asset | STRIDE Threats | Mitigations | Residual Risk |
| --- | --- | --- | --- |
| Customer identities (PII records in PostgreSQL) | **Spoofing**: Credential stuffing against login endpoints. **Tampering**: SQL injection or privilege escalation modifying account data. **Repudiation**: Disputed administrative actions. **Information Disclosure**: Data exfiltration via insecure endpoints. **Denial of Service**: Exhaustion of database connections. **Elevation of Privilege**: Compromised service account with broad access. | Mandatory MFA for operators, rate limiting and lockout policies, parameterized queries with ORM, row-level authorization, immutable audit logging, network segmentation, and scoped DB roles. | Sophisticated phishing could bypass MFA; zero-day DB vulnerabilities may permit unauthorized access despite defenses. |
| Transaction instructions (worker queues) | **Spoofing**: Rogue worker impersonating legitimate job consumer. **Tampering**: Malicious message alteration in transit. **Repudiation**: Lack of traceability for processed jobs. **Information Disclosure**: Leakage of message payloads. **Denial of Service**: Queue flooding to delay processing. **Elevation of Privilege**: Compromised worker assumes admin capabilities via queue messages. | Mutual TLS between producers/consumers, message authentication with signed payloads, queue-level RBAC, structured logging with trace IDs, autoscaling and quotas, runtime secrets management using short-lived tokens. | Insider with queue access could manipulate payloads before signatures are verified; resource exhaustion possible if autoscaling misconfigured. |
| Offer documents and investor reports (object storage) | **Spoofing**: Unauthorized client presenting forged pre-signed URL. **Tampering**: Altered documents uploaded via misconfigured ACLs. **Repudiation**: Disputes over who accessed or modified documents. **Information Disclosure**: Public exposure through incorrect sharing controls. **Denial of Service**: Mass download or delete actions. **Elevation of Privilege**: Privilege creep in storage IAM roles. | Time-bound signed URLs tied to identity, server-side encryption, versioned storage buckets, immutable audit trails via storage logs, throttling and anomaly detection, periodic IAM reviews. | Misconfiguration during bucket provisioning could expose objects until detected; monitoring gaps may delay detection of malicious downloads. |
| Deployment pipeline (CI/CD) | **Spoofing**: Compromised developer credentials triggering builds. **Tampering**: Malicious code injected into build artifacts. **Repudiation**: Developers denying ownership of risky changes. **Information Disclosure**: Secrets leaked in build logs. **Denial of Service**: Build agent exhaustion. **Elevation of Privilege**: Build agent obtaining excessive cloud permissions. | Enforced code reviews, signed commits, build agent isolation with ephemeral runners, secrets scanning, artifact signing, least-privilege IAM for pipeline roles, and retention policies for logs. | Supply-chain attacks on dependencies could bypass detections; limited visibility into third-party action compromise windows. |
| Monitoring and alerting telemetry | **Spoofing**: Forged metrics to hide incidents. **Tampering**: Log alteration to delete traces. **Repudiation**: Operators denying suppression of alerts. **Information Disclosure**: Sensitive data in logs. **Denial of Service**: Alert storm overwhelming responders. **Elevation of Privilege**: Monitoring tools leveraged for lateral movement. | Authenticated ingestion endpoints, append-only logging with write-once storage tiers, log scrubbing policies, anomaly detection with automated triage, RBAC-protected dashboards, and alert deduplication with rate controls. | Telemetry channels may still carry sensitive data if classification fails; insider abuse of monitoring dashboards remains possible. |

## Mitigation Roadmap
1. Expand phishing-resistant authentication (FIDO2) for all operator accounts to reduce spoofing and credential stuffing risk.
2. Automate continuous configuration monitoring of storage buckets and queue policies to detect misconfigurations within minutes.
3. Integrate supply-chain security scanning (SLSA-compliant) into CI/CD for third-party dependencies and containers.
4. Implement secretless job execution for workers using workload identity federation to minimize impact of credential theft.

## Residual Risk Summary
- **Operational**: Reliance on manual configuration reviews introduces potential drift between environments.
- **Third-Party**: Exposure to compromises in managed identity providers and external SaaS monitoring platforms.
- **Detection**: Alerting gaps for low-and-slow data exfiltration could delay detection beyond established SLAs.
- **Business Impact**: Unauthorized access to investor data would trigger breach notification obligations and regulatory scrutiny.
