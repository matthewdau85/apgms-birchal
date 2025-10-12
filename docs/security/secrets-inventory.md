# Secrets Inventory

This document tracks the locations where secrets are stored, how they are delivered at runtime, and the controls protecting them. It also documents procedures for adding and rotating secrets and the safeguards that prevent secrets from being committed to source control.

## Operational overview

| Scope | Storage | Delivery | Rotation owner | Notes |
| --- | --- | --- | --- | --- |
| Production workloads | AWS Secrets Manager | Retrieved at service startup via IAM role | Platform team | Secrets are versioned and rotated quarterly; emergency rotation uses `scripts/key-rotate.ps1`. |
| Non-production workloads | `.env` files stored in 1Password vault | Pulled during deployment by CI | Platform team | Test secrets are masked in CI logs and rotated monthly. |
| Local development | `.env.local` files | Developers load from password manager | Engineering teams | Developers must never commit local secrets. Use sample `.env.example` instead. |
| Third-party integrations | Vendor portals | Secure notes in 1Password | Integration owner | Vendor secrets are mirrored into AWS Secrets Manager before deployment. |

## Access controls

- Secrets in AWS are scoped to IAM roles per service. Only the deployment role for a service can access its runtime secrets.
- Access to the shared 1Password vault is granted via the "APGMS Engineering" group with mandatory 2FA.
- CI workflows rely on GitHub Actions secrets and OpenID Connect to fetch runtime credentials. No long-lived tokens are checked into the repository.

## Guardrails

To keep secrets out of source control:

1. Developers must store example configuration values in `*.example` files rather than real credentials.
2. Pull requests are automatically scanned with `pnpm secret-scan`, which checks for common secret patterns.
3. Any suspected secret exposure must be reported in Slack `#security-incidents` within 15 minutes. The on-call engineer will rotate the secret using the documented playbooks in `docs/security/`.

## Adding a new secret

1. Provision the secret in AWS Secrets Manager (production) or 1Password (non-production).
2. Document the secret name, rotation cadence, and responsible owner in this inventory.
3. Update application configuration to read the secret from the approved storage location.
4. Run `pnpm secret-scan` before committing to ensure no secrets were accidentally introduced.

## Rotation checklist

- Confirm the new secret works in staging before rotating production.
- Rotate associated API keys at the provider and invalidate the previous values.
- Update infrastructure code or configuration management references.
- Communicate the rotation in the weekly security sync notes.

## Incident response

If a secret is leaked:

1. Revoke or rotate the secret immediately.
2. Purge cached copies from build artifacts and rerun deployments with the new secret.
3. Add a retrospective entry describing the root cause and remediation in `docs/security/incidents.md`.

Maintaining this inventory and running the automated scans ensures secrets remain protected throughout the development lifecycle.
