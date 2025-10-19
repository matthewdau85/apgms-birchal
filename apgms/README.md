# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

### Release checklist

- [ ] `pnpm i && pnpm -r build`
- [ ] `pnpm -r test`
- [ ] `docker compose up -d` (postgres/redis)
- [ ] `API_GATEWAY_KEY=... pnpm --filter @apgms/api-gateway dev`
- [ ] `curl -H "x-api-key: $API_GATEWAY_KEY" localhost:3000/health` => 200
- [ ] `curl -H "x-api-key: $API_GATEWAY_KEY" localhost:3000/ready`  => 200
