# Identity Security Evidence

The screenshots referenced in the security posture documentation should be stored in this directory. Capture them directly from the Okta admin console to demonstrate the configured policies.

## Required Screenshots

1. **`mfa-policy-screen.png`** – Capture the Authentication Policy `APGMS-Prod-Auth` showing both TOTP and WebAuthn marked as required factors for the production user group.
2. **`webauthn-enforced.png`** – Capture the policy rule configuration showing WebAuthn listed as a mandatory factor for the `platform-admin` and `security-analyst` groups (step-up requirement for `/admin/**` and `/capital/**`).
3. **`session-policy.png`** – Capture the session policy `APGMS-Prod-Session` highlighting the 12-hour maximum session lifetime, 15-minute idle timeout, and disabled remembered devices.

Replace these placeholder files with the actual screenshots once they have been exported from the IdP.
