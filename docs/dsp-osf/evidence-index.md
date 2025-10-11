# DSP-OSF Evidence Index

This index provides traceability between DSP-OSF controls and supporting evidence. Entries between the `evidence-start` and `evidence-end` markers are automatically managed by `update_evidence_index.py`.

## Evidence Register

<!-- evidence-start -->
| Control | Artifact | Location | Last Updated |
| --- | --- | --- | --- |
| Supply Chain Security | [Software Bill of Materials (SBOM)](.github/artifacts/sbom.json) | .github/artifacts/sbom.json | 2025-10-11 19:24:17 UTC |
| Vulnerability Management | [Security Scan Log](.github/artifacts/security-scan.log) | .github/artifacts/security-scan.log | 2025-10-11 19:24:17 UTC |
| Performance & Resilience | [k6 Load Test Report](.github/artifacts/k6-report.html) | .github/artifacts/k6-report.html | 2025-10-11 19:24:17 UTC |
<!-- evidence-end -->

## Manual Evidence

- Incident postmortems stored in `/runbooks/incidents/`.
- Quarterly penetration test reports archived in secure SharePoint.
- Business continuity test results tracked via Jira project `BCDR`.

