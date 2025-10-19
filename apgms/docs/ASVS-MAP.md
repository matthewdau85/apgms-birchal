# OWASP ASVS Mapping (V1–V3)

This catalogue links key Level 2 controls to the codebase, operational runbooks, and assurance activities.

| Control | Implementation Summary | Evidence Links | Status |
| --- | --- | --- | --- |
| **V1.1.1** – Documented architecture | C4 context and sequence diagrams describe service boundaries and data flows. | [docs/architecture/README.md](./architecture/README.md) | Implemented |
| **V1.4.3** – Security requirements captured | Security and privacy requirements are documented as living controls. | [SECURITY.md](./SECURITY.md), [PRIVACY.md](./PRIVACY.md) | Implemented |
| **V1.10.1** – Abuse case handling | Rate-limiting runbooks and load tests prevent enumeration and replay. | [SECURITY.md](./SECURITY.md#rate-limiting-and-abuse-detection), [k6/debit-path.js](../k6/debit-path.js) | In progress |
| **V2.1.1** – Centralised authentication | All interactive access flows through the corporate IdP with enforced MFA. | [SECURITY.md](./SECURITY.md#identity-and-mfa-via-identity-provider) | Implemented |
| **V2.7.4** – Password storage controls | Production users authenticate via IdP; local seed credentials flagged for replacement with IdP federation hooks. | [shared/prisma/schema.prisma](../shared/prisma/schema.prisma), [scripts/seed.ts](../scripts/seed.ts) | Gap |
| **V2.10.2** – Automated CI security tests | Security workflow executes scanners on every push. | [.github/workflows/security.yml](../.github/workflows/security.yml) | Implemented |
| **V3.1.1** – Session lifecycle defined | Session duration, renewal, and re-authentication thresholds defined in IdP policy. | [SECURITY.md](./SECURITY.md#identity-and-mfa-via-identity-provider) | Implemented |
| **V3.2.2** – Session revocation on logout/off-boarding | Off-boarding process revokes tokens and removes IdP entitlements. | [SECURITY.md](./SECURITY.md#identity-and-mfa-via-identity-provider) | Implemented |
| **V3.4.1** – Protect session data in transit | TLS, cache control, and security headers prevent token leakage. | [SECURITY.md](./SECURITY.md#security-headers-and-transport-guarantees), [services/api-gateway/src/index.ts](../services/api-gateway/src/index.ts) | Planned |

Status legend: **Implemented** – in production today; **In progress** – partially automated with follow-up items; **Gap** – requires backlog work before release.
