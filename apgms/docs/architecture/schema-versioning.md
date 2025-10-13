# Cross-service schema versioning

To prevent drift between services we apply the following policies:

1. **Semantic versioning** – every OpenAPI and protobuf artifact is versioned using `MAJOR.MINOR.PATCH`. Backwards-incompatible changes bump the major version and require API Gateway routing rules for dual-run periods.
2. **Migration manifests** – database migrations ship with a `migration.yaml` manifest describing dependent services, rollout order, and verification queries. GitHub Actions blocks deployment if the manifest is missing or references unknown services.
3. **Contract tests** – the shared `tests/contracts` suite executes consumer-driven tests on every pull request, ensuring schema updates remain backwards compatible within the declared minor version.
4. **Deprecation windows** – producers must keep prior major versions live for 90 days, with automated alerts 30 days before removal.
5. **Documentation** – release notes are generated from the manifest metadata and stored in `/docs/dsp-osf/change-control` to maintain a permanent audit trail.

Engineering leads review the schema backlog fortnightly to coordinate cross-team updates and to ensure the manifests stay current with production deployments.
