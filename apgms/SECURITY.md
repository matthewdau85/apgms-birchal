# Security Policy

## Reporting a Vulnerability
Please email security@apgms.example with a clear description of the vulnerability, steps to reproduce, and any supporting artifacts. Encrypt sensitive details with our PGP key (fingerprint: 6A0C 4C32 7B58 1F9D 8F70  4E1A 6F0C 2233 9ADE B102) when possible.

## Triage Service-Level Objectives
| Severity | Initial Response | Triage & Fix Plan | Target Patch Release |
|----------|------------------|-------------------|-----------------------|
| Critical | 4 business hours | 1 business day    | 3 business days       |
| High     | 1 business day   | 2 business days   | 7 calendar days       |
| Medium   | 2 business days  | 5 business days   | 21 calendar days      |
| Low      | 5 business days  | 10 business days  | Next scheduled release|

We provide status updates to reporters at each stage and before closing the ticket.

## Supported Versions
| Version Line | Support Level | Notes |
|--------------|---------------|-------|
| Main branch deployments | Full security support | Hotfixes and backports applied as needed |
| Last quarterly release | Security fixes only | Receives patches for High/Critical issues |
| Older releases | No security guarantees | Upgrade required |

## Authentication & Identity Posture
All APGMS-maintained SaaS environments enforce SSO through our Okta identity provider with mandatory multi-factor authentication. Administrative accounts require WebAuthn hardware keys; break-glass accounts are stored offline and rotated quarterly.

## Key & Secrets Management
Production secrets, TLS certificates, and signing keys are stored in HashiCorp Vault with auto-unseal backed by cloud KMS. Access is scoped via least-privilege policies, dual control is required for exporting signing keys, and all key material rotations are logged to our SIEM. Client-side encryption keys are generated per-tenant and rotated annually or upon compromise.
