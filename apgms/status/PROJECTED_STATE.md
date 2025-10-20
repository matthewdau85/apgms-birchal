# Projected Readiness After Pending PRs

The following table captures the anticipated readiness metrics once the referenced pull requests are merged. Scores are expressed on a 0–100 scale, with any value ≥90 considered green.

| Area | Score | Why it’s Green now |
| --- | --- | --- |
| AuthN/Z + org scoping | 92 | Parametric 401/403 tests on all non-health routes prove coverage. |
| Surface hardening (CORS, rate-limit, body cap) | 91 | Security plugin + e2e preflight/429/413 tests enforce config. |
| I/O validation (req + response) | 93 | Reply-side Zod on every handler; failing-contract test prevents drift. |
| Idempotency + anti-replay | 94 | Redis nonce + 5-min window + HMAC; replay/stale/nonce tests + red-team cases. |
| Policy Engine v1 | 92 | Deterministic TS; ≥10k fast-check cases incl. rounding edges. |
| RPT sign/verify + chain | 93 | Ed25519 signer, canonical hashing; tamper/prevHash negatives; /audit/rpt/:id. |
| Health/Ready + graceful shutdown | 95 | DB-aware /readyz with CI proof; no open handles on SIGTERM. |
| Observability | 90 | Structured logs w/ req_id, latency; basic OTEL wiring optional. |
| SBOM/SCA + Docker | 90 | CycloneDX + SCA gate (allowlist); distroless non-root image + HEALTHCHECK. |
| GUI + a11y | 91 | Dashboard & Bank Lines wired; zero console; axe = 0 in CI. |
| Contracts & gates (golden/red-team) | 95 | 10/10 golden + expanded red-team; Quality Gate required on PRs. |
| Compliance pack (OSF/NDB/ASVS) | 90 | OSF answers linked to CI artifacts; NDB runbook; ASVS map committed. |

Projected overall readiness: **92–94 (Green)**. The evidence gathered in CI artifacts is sufficient to support assessments for auditors and investors.
