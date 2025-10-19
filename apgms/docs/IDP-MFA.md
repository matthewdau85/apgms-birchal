# MFA Posture for Admin Routes

This service enforces multi-factor authentication (MFA) for every request that targets `*/admin/*` routes. The middleware validates OpenID Connect (OIDC) ID tokens issued by the configured identity provider and requires proof of MFA through either the Authentication Method Reference (`amr`) claim or the Authentication Context Class Reference (`acr`) claim.

## Identity Provider Configuration

Configure your IdP to issue the following claims in ID tokens for the API gateway:

- **Issuer (`iss`)** – must match `OIDC_ISSUER`.
- **Audience (`aud`)** – must contain `OIDC_AUDIENCE`.
- **Organisation (`orgId` or `org_id`)** – identifies the tenant.
- **Roles (`roles`)** – space or comma separated string or array of granted roles.
- **Authentication Method Reference (`amr`)** – should include `mfa` when MFA was performed.
- **Authentication Context Class Reference (`acr`)** – optional numeric strength indicator such as `urn:acr:2fa`.

The API gateway expects the following environment variables at runtime:

```bash
export OIDC_ISSUER="https://issuer.example.com"
export OIDC_AUDIENCE="api://default"
export JWT_SHARED_SECRET="super-secret-hs256-key"
```

`JWT_SHARED_SECRET` must match the symmetric signing key used by the IdP for HS256 tokens (or be replaced with the appropriate verification material when migrating to asymmetric keys).

## MFA Evaluation Rules

The middleware derives `req.context.mfa` using the rules below:

1. If `amr` is an array or delimited string containing `mfa`, MFA is satisfied.
2. Otherwise, if `acr` matches `urn:acr:{level}fa` where `level` is greater than or equal to `2`, MFA is satisfied.
3. If neither claim satisfies the above, the request is treated as single-factor.

Requests to `/admin/*` endpoints without MFA evidence are rejected with HTTP 403.

## Example ID Token Payload

```json
{
  "iss": "https://issuer.example.com",
  "aud": "api://default",
  "sub": "user-123",
  "orgId": "org-1",
  "roles": ["admin"],
  "amr": ["pwd", "mfa"],
  "acr": "urn:acr:2fa",
  "exp": 1735689600,
  "iat": 1735686000
}
```

## Claims Emission for CI

Use `pnpm --filter @apgms/api-gateway run emit-claims <token>` to decode an ID token during CI. The script writes the parsed claims to `artifacts/claims.json`, enabling automated evidence collection for compliance checks.
