# DSP OSF control matrix

*Last refreshed: 2025-10-12T01:57:04.945Z (source: local)*

| Control | OSF section(s) | Implementation evidence | CI artifact |
| --- | --- | --- | --- |
| Authentication | OSF 2.2 - Identity & Access Control | API Gateway enforces bearer token authentication for every request to financial data endpoints. | [CI build & test logs](https://github.com/birchal/apgms-birchal/actions/workflows/ci.yml?query=event%3Arelease) |
| Logging | OSF 3.3 - Security Monitoring | Fastify services emit structured request and application logs to support incident investigations. | [CI build & test logs](https://github.com/birchal/apgms-birchal/actions/workflows/ci.yml?query=event%3Arelease) |
| Software Bill of Materials (SBOM) | OSF 4.2 - Software Supply Chain Integrity | Security workflow publishes a CycloneDX SBOM for the pnpm workspace on every push. | [Security workflow artifacts](https://github.com/birchal/apgms-birchal/actions/workflows/security.yml?query=event%3Arelease) |
| Automated Scans | OSF 4.3 - Vulnerability Management | Security workflow runs dependency audits and retains reports for traceability. | [Security workflow artifacts](https://github.com/birchal/apgms-birchal/actions/workflows/security.yml?query=event%3Arelease) |
