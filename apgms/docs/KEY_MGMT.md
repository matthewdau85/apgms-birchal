# Key Management Strategy

## Custody Model
- The default `dev` signer keeps ephemeral RSA keys in memory for local development.
- Production and staging environments must set `SIGNER_PROVIDER=kms` so request payment tokens (RPTs) are signed by AWS KMS keys (`KMS_KEY_ID`).
- KMS provides hardware-backed custody; application hosts never receive private key material, only signatures.

## Rotation Policy
- Rotate the active `KMS_KEY_ID` at least every 90 days or when mandated by compliance requirements.
- Use AWS KMS key aliases to stage new keys, then update `KMS_KEY_ID` through infrastructure configuration.
- After rotation, verify new signatures end-to-end and decommission prior keys only after dependent services confirm acceptance.

## Separation of Duties (SoD)
- Platform engineers provision and manage the AWS KMS key and IAM policies.
- Application operators configure deployment secrets (environment variables) without access to modify KMS policies.
- Security teams audit key usage through CloudTrail and the `/evidence/keys/provider.json` artifact emitted at service boot.

## Emergency Key Revocation
- Disable the compromised KMS key in AWS immediately to prevent further signatures.
- Update service configuration to point to an alternate standby key, redeploy, and confirm signatures verify as expected.
- Document the incident, purge dependent caches, and notify relying parties that prior signatures should be considered untrusted.

## Change Control
- All changes to signing configuration require code review and change management approval.
- Evidence files written to `evidence/keys/provider.json` capture the active provider, key ID, region, and timestamp for audit trails.
- Tests cover both dev and KMS providers to ensure safe deployments when toggling the `SIGNER_PROVIDER` flag.
