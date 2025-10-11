# Ops runbook

## Smoke checklist

- [ ] `pnpm fmt:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm -r test`
- [ ] `docker compose up -d (db, redis)`
- [ ] `pnpm run db:migrate && pnpm run db:seed`
- [ ] API `GET /health` returns 200
- [ ] API `GET /users` returns 200
- [ ] API `GET /bank-lines` returns 200
- [ ] Web at http://localhost:5173/
- [ ] `/metrics` reachable
- [ ] Playwright e2e
- [ ] k6 thresholds
