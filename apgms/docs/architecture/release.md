# Release Process

This document describes how we prepare and publish releases for the API gateway and tax engine services. It covers versioning, container image publication, and the checklist we follow for deployments to production environments.

## Versioning strategy

We follow a lightweight semantic versioning approach:

- **Major (X.y.z)** — backwards-incompatible API or database changes.
- **Minor (x.Y.z)** — backwards-compatible functionality, new endpoints, or infrastructure changes.
- **Patch (x.y.Z)** — bug fixes, dependency updates, or internal-only changes.

Each production deploy increments the appropriate segment. Tags in Git use the format `vX.Y.Z` and are pushed from the `main` branch. Container images are additionally tagged with the git SHA by CI; version tags should be pushed manually when creating a release.

## Release cadence

Releases are created as needed. When a change is ready for production it should be merged to `main`, after which the steps in the checklist below are followed. Emergency fixes can be released immediately after validation.

## Deployment checklist

1. **Validate the change set**
   - Confirm CI (unit, integration, and container builds) completed successfully for the merge commit.
   - Review the diff to ensure all migrations and configuration changes are included.
2. **Prepare the release**
   - Decide the next semantic version number based on the changes.
   - Update changelog or release notes with key items (API changes, migrations, infrastructure updates).
3. **Tag the release**
   - Checkout the target commit on `main`.
   - Create and push the git tag `vX.Y.Z`.
   - Verify that CI publishes images tagged with the git SHA (`ghcr.io/<org>/<service>:<sha>`).
4. **Deploy services**
   - Pull the tagged images for `api-gateway` and `tax-engine` from GHCR.
   - Apply any infrastructure or configuration updates required for the release.
   - Roll out the new containers to the target environment (staging, then production).
5. **Post-deploy validation**
   - Check service health endpoints (`/health`) and logs.
   - Run smoke tests through the Fastify gateway and tax engine APIs.
   - Monitor metrics and alerts for at least one full error budget window.
6. **Close the release**
   - Communicate release completion to stakeholders.
   - File follow-up issues for any deferred work or remediation.

Following this checklist ensures that each release is well-understood, versioned correctly, and traceable back to the underlying commit and container image.
