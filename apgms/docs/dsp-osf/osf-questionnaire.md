# DSP Operational Security Framework Questionnaire

| Control | Response | Evidence |
| --- | --- | --- |
| Multi-factor authentication posture | All privileged identities enforced via IdP conditional access (WebAuthn + TOTP fallback). | CI artifact `security-compliance-<run_id>/scan-summary.md`; policy docs `SECURITY.md`. |
| Replay protection | All inbound requests carry signed nonces validated in the API gateway; Redis stores nonce digests for 15 minutes to block replays. | API gateway configuration, automated tests under `tests/e2e`, and the Quality Gate artifact. |
| SBOM availability | CycloneDX SBOM generated per build and attached to PRs/releases. | GitHub Actions security workflow artifacts and release compliance job uploads. |
| Test suites | Unit, integration, and policy tests enforced via the Quality Gate workflow. | `quality-gate-summary` artifact and workflow history. |
| Incident response | NDB runbook aligned with OAIC obligations. | `runbooks/ndb.md`. |
| Dependency integrity | pnpm lockfile signed with Sigstore Cosign and verified each run. | `security` workflow logs and signature bundle artifacts. |
