# Security policy

We take the security of the APGMS platform seriously and appreciate coordinated
vulnerability disclosure from the community.

## Reporting a vulnerability

- Email: [security@apgms.example](mailto:security@apgms.example)
- Encryption: Request our PGP key via the security contact email.
- Please include a proof-of-concept, affected components and any known mitigation.
- We commit to acknowledging new reports within **1 business day** and providing a
  triage status within **5 business days**.

If you believe the issue exposes regulated data or financial risk, mark the subject
as `URGENT` so the on-call security engineer is paged automatically.

## Supported versions

| Version | Supported | Notes |
| --- | --- | --- |
| `main` branch | ✅ | Actively monitored and patched.
| Tagged releases < 90 days old | ✅ | Receive security backports when feasible.
| Archived releases | ❌ | No security fixes; upgrade to a supported version.

## Coordinated disclosure process

1. Reporter submits the vulnerability report via email (or encrypted channel).
2. Security engineering triages the report, assigns severity, and logs the ticket in
   the private incident tracker.
3. If exploitation risk is high, the [TFN Security SOP](docs/security/TFN-SOP.md)
   escalation path is initiated.
4. Fixes are developed, peer reviewed, and verified using the automated test suite
   (`pnpm -r test`) and targeted scenarios (for example [`k6/debit-path.js`](k6/debit-path.js)).
5. Once mitigations ship, we notify the reporter with remediation details and,
   where relevant, coordinate public disclosure after mutual agreement.

## Security hardening roadmap

Refer to the [OWASP ASVS control map](docs/ASVS-control-map.csv) for the current
status of application security controls and pending follow-up actions.
