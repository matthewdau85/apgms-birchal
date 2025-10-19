# Multi-factor Authentication Posture

## Identity Provider Configuration

1. **Enable MFA policies**
   - Require time-based one-time password (TOTP) or WebAuthn authenticators for the `admin` application profile.
   - Enforce step-up rules so that any session requesting the `https://api.apgms.local/admin` audience is prompted for a registered MFA factor when the session is older than 12 hours or the last login lacked an MFA assurance.
2. **Allowed factors**
   - TOTP applications that support RFC 6238 (e.g., Google Authenticator, 1Password, Authy).
   - WebAuthn security keys or platform authenticators with resident keys enabled.
3. **Session lifetime**
   - Set a maximum MFA lifetime of 24 hours and force re-authentication after inactivity of 12 hours for administrator scopes.

## Claim Mapping

- Map the organisation identifier to the `org` claim (or the custom claim `https://apgms.io/org`).
- Include MFA assurance data using:
  - `amr` array entries (e.g., `pwd`, `mfa`, `hwk`).
  - `acr` level strings. Configure a value equal to or higher than `urn:mfa` when a strong factor was verified.
- Ensure administrator groups resolve to tokens carrying the `admin` scope and MFA claims.

## Admin Routes Requiring MFA

The following API Gateway routes enforce the MFA middleware and deny access when the MFA claim is missing:

- `GET /admin/keys`
- Any additional route registered under the `/admin/*` prefix automatically inherits the MFA requirement via the shared guard middleware.

## Local Testing

Run the unit tests to verify the middleware behaviour:

```bash
pnpm install
pnpm test:root
pnpm test
```

Alternatively, run the focused test file:

```bash
pnpm exec tsx --test tests/auth.mfa.spec.ts
```

A successful run should report one failing request (403) for non-MFA tokens and one passing request (200) for MFA-bearing tokens.
