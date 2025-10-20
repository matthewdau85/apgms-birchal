# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

## Gateway observability

* Prometheus scrapes the API gateway at `/metrics`.
* Smoke checks:
  * `curl :3000/ready` → `{ "ready": true }`
  * `curl :3000/metrics` returns text metrics
