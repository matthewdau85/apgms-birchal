# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

Smoke tests:

```
curl :3000/health
curl :3000/ready
curl :3000/metrics
```
