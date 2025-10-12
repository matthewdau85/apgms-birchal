# DSP OSF control coverage matrix

> Alignment of implemented controls to the Digital Service Provider Operational Security Framework as published via the Federal Register of Legislation.
>
> _This file is auto-generated; edit **scripts/refresh-osf-matrix.js** instead._

| Control | OSF section | Implementation summary | Evidence |
| --- | --- | --- | --- |
| Authentication & access management | OSF 4.2 – Access management | Fastify API gateway centralises ingress and loads environment managed secrets before registering routes ([API gateway service](../../services/api-gateway/src/index.ts)).<br />Shared Prisma client encapsulates database identity for service-to-service operations ([Shared Prisma client](../../shared/src/db.ts)). | [CI build & test](https://github.com/apgms/apgms-birchal/actions/workflows/ci.yml)<br />[E2E smoke tests](https://github.com/apgms/apgms-birchal/actions/workflows/e2e.yml) |
| Logging & audit trails | OSF 5.4 – Security monitoring & logging | Fastify logger is enabled for the gateway, recording structured operational events ([API gateway logger configuration](../../services/api-gateway/src/index.ts)).<br />Error handling captures failures with contextual metadata for investigation ([Bank line ingestion handler](../../services/api-gateway/src/index.ts)). | [CI build & test](https://github.com/apgms/apgms-birchal/actions/workflows/ci.yml) |
| SBOM & supply chain governance | OSF 6.1 – Software integrity & provenance | Workspace lockfiles are under version control for deterministic builds ([Root pnpm lockfile](../../pnpm-lock.yaml)).<br />Release automation refreshes this matrix to surface dependency attestations ([Release matrix workflow](../../.github/workflows/release-matrix.yml)). | [Release matrix workflow](https://github.com/apgms/apgms-birchal/actions/workflows/release-matrix.yml) |
| Vulnerability scanning | OSF 7.2 – Vulnerability management | Dedicated security workflow runs on every push to execute scanning steps ([Security workflow](../../.github/workflows/security.yml)). | [Security scans](https://github.com/apgms/apgms-birchal/actions/workflows/security.yml) |

## Detailed control notes

### Authentication & access management

**OSF focus:** OSF 4.2 – Access management.

#### Implementation highlights

- Fastify API gateway centralises ingress and loads environment managed secrets before registering routes ([API gateway service](../../services/api-gateway/src/index.ts)).
- Shared Prisma client encapsulates database identity for service-to-service operations ([Shared Prisma client](../../shared/src/db.ts)).

#### Evidence retained

- [CI build & test](https://github.com/apgms/apgms-birchal/actions/workflows/ci.yml) – Builds and tests all workspaces on each push to guard gateway integrations.
- [E2E smoke tests](https://github.com/apgms/apgms-birchal/actions/workflows/e2e.yml) – Playwright workflow verifies authentication pathways when triggered before release.

### Logging & audit trails

**OSF focus:** OSF 5.4 – Security monitoring & logging.

#### Implementation highlights

- Fastify logger is enabled for the gateway, recording structured operational events ([API gateway logger configuration](../../services/api-gateway/src/index.ts)).
- Error handling captures failures with contextual metadata for investigation ([Bank line ingestion handler](../../services/api-gateway/src/index.ts)).

#### Evidence retained

- [CI build & test](https://github.com/apgms/apgms-birchal/actions/workflows/ci.yml) – Lints and tests services ensuring logging hooks compile and execute.

### SBOM & supply chain governance

**OSF focus:** OSF 6.1 – Software integrity & provenance.

#### Implementation highlights

- Workspace lockfiles are under version control for deterministic builds ([Root pnpm lockfile](../../pnpm-lock.yaml)).
- Release automation refreshes this matrix to surface dependency attestations ([Release matrix workflow](../../.github/workflows/release-matrix.yml)).

#### Evidence retained

- [Release matrix workflow](https://github.com/apgms/apgms-birchal/actions/workflows/release-matrix.yml) – Runs on every published release to regenerate documentation and attach evidence.

### Vulnerability scanning

**OSF focus:** OSF 7.2 – Vulnerability management.

#### Implementation highlights

- Dedicated security workflow runs on every push to execute scanning steps ([Security workflow](../../.github/workflows/security.yml)).

#### Evidence retained

- [Security scans](https://github.com/apgms/apgms-birchal/actions/workflows/security.yml) – Automated scanning pipeline triggered on each push, retaining execution artefacts.
