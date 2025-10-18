# Security Policy

Security contact: [security@yourdomain.example](mailto:security@yourdomain.example)

## Reporting vulnerabilities
- Please disclose suspected vulnerabilities privately via email.
- Include proof-of-concept steps, impacted components, and suggested mitigations when possible.
- We will acknowledge receipt within 48 hours and provide an initial triage update within five business days.

## Continuous assurance
- Every push, pull request, scheduled scan, and release runs the **Security** workflow which:
  - Generates a CycloneDX SBOM with Syft and stores it as a build artifact.
  - Executes Trivy and Grype software composition analysis with enforced allowlisting; the pipeline fails on any non-allowlisted high/critical finding.
  - Signs and verifies the dependency lockfile using Sigstore Cosign keyless signing.
  - Publishes all scan outputs (SBOM, Trivy JSON, Grype JSON, summary, and signature bundle) as downloadable artifacts.
- Policy-as-code checks built with Conftest/OPA evaluate infrastructure manifests, rendered Helm charts, and GitHub Actions workflows for mandatory controls (non-root, read-only filesystem, explicit permissions).
- Hardened container images for runtime workloads are built from distroless bases, run as non-root, expose read-only roots, and include container-level health checks.

## Release governance
- Releases automatically regenerate SBOMs and compliance artifacts and attach them to the GitHub release for downstream consumers.
- Compliance evidence (SBOM, Cosign attestations, MFA posture, replay protection notes, quality gate results) is indexed in `docs/dsp-osf/osf-questionnaire.md`.

## Vulnerability allowlisting
- All exceptions are recorded in `apgms/security/vulnerability-allowlist.json` with documented rationale and expiry dates.
- Expired or unapproved vulnerabilities break the pipeline until the item is remediated or the allowlist entry is renewed.

## Incident response
- Out-of-band incident handling and notification procedures are documented in `runbooks/ndb.md` and the platform runbooks repository.
