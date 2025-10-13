# Authentication controls

- External clients authenticate using OAuth 2.0 client credentials with mutual TLS.
- Internal services exchange signed JWTs issued by the identity service with 5-minute expiries and rotating HMAC secrets.
- Secrets rotate automatically every 30 days via GitHub Actions integration with AWS Secrets Manager.
- Failed authentication attempts trigger alerting after 10 consecutive failures per client per 5 minutes.
