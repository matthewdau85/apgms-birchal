# Identity Security Posture

This document captures the identity provider (IdP) security posture that protects the APGMS platform. The configuration is managed in Okta and applied to all production and staging tenants.

## Multi-factor Authentication (MFA)

* **IdP enforcement:** Okta Global Authentication Policy `APGMS-Prod-Auth`
* **Primary factor:** Password (see [Password Policy](#password-policy))
* **Secondary factors required:**
  * Time-based One-Time Password (TOTP) via Okta Verify or Google Authenticator
  * WebAuthn FIDO2 security keys (YubiKey, Face ID, Windows Hello)
* **Enrollment rules:** Both TOTP and WebAuthn must be registered before first access to protected routes. Enrollment is enforced during the first successful login.
* **Re-authentication cadence:** Users must complete MFA every 12 hours or whenever accessing a high-risk route that has not been accessed in the last 30 minutes.

### MFA enforcement matrix

| Scope | Routes | Required roles | Enforcement |
| --- | --- | --- | --- |
| Administrative console | `/admin/**` | `platform-admin`, `security-analyst` | MFA required on every login and after 15 minutes of inactivity. |
| Investor onboarding APIs | `/api/v1/investors/*` (POST, PUT, DELETE) | `onboarding-agent` | MFA must be fresh within last 30 minutes; otherwise the IdP forces step-up verification. |
| Capital management tools | `/capital/**` web app | `capital-manager`, `finance-admin` | WebAuthn step-up enforced in addition to TOTP. |
| Support tooling | `/support/**` | `support-specialist` | Standard MFA cadence (12 hours) applies. |

Evidence screenshots are located in [`docs/evidence/`](evidence/README.md):

* [`mfa-policy-screen.png`](evidence/mfa-policy-screen.png) – IdP policy showing required TOTP and WebAuthn factors.
* [`webauthn-enforced.png`](evidence/webauthn-enforced.png) – Policy rule demonstrating WebAuthn as a mandatory second factor for admin routes.
* [`session-policy.png`](evidence/session-policy.png) – Session rule capturing lifetime and re-authentication window.

## Session Lifetime

* **Policy name:** `APGMS-Prod-Session`
* **Maximum session lifetime:** 12 hours of continuous activity.
* **Idle timeout:** 15 minutes. Users are redirected to the IdP to re-authenticate after idle timeout.
* **Step-up trigger:** Access to `/admin/**`, `/capital/**`, or use of the investor onboarding API after idle timeout requires MFA.
* **Remembered device window:** 0 days (devices are not remembered).

## Password Policy

* **Policy name:** `APGMS-Strong-Password`
* **Length requirement:** Minimum 14 characters, maximum 64 characters.
* **Complexity:** Must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.
* **Re-use restriction:** Cannot reuse the previous 10 passwords.
* **Expiration:** 180-day rotation enforced by the IdP.
* **Lockout:** 5 failed attempts trigger a 15-minute lockout; after 3 lockouts the account is suspended pending security review.

## Account Recovery Policy

* **Policy name:** `APGMS-Account-Recovery`
* **Self-service reset:** Enabled only for users with the `support-specialist` role; other roles must request recovery via the security team.
* **Recovery factors:**
  * TOTP verification (must match previously enrolled device)
  * WebAuthn security key (primary recovery factor)
  * Backup codes (10 single-use codes issued at enrollment)
* **Administrative unlock:** Only users in the `platform-admin` role can unlock suspended accounts after validating the user via an out-of-band channel.
* **Audit logging:** All recovery attempts are logged in the IdP and forwarded to the SIEM for 365-day retention.

## Change Management

* **Review cadence:** Policies reviewed quarterly by the security team.
* **Approval workflow:** Changes require approval from both the CISO and the engineering lead.
* **Testing:** All policy changes are validated in the staging tenant before production rollout.
