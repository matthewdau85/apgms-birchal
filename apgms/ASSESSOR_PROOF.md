# Green Readiness Proof Pack

This checklist records the artifacts audited for Green readiness. Each item references the expected location of the required asset. The automated verifier at `scripts/verify-green.ts` enforces the same expectations during CI.

- [ ] Authentication guard implementation — `shared/src/auth.ts`
- [ ] Organisation scope enforcement — `shared/src/org-scope.ts`
- [ ] Bank data line handler — `services/banking/src/bank-lines.ts`
- [ ] Idempotency controller — `shared/src/idempotency.ts`
- [ ] Shared configuration surface — `shared/src/config.ts`
- [ ] Public OpenAPI definition — `docs/openapi.json`
- [ ] Container build definition(s) — `Dockerfile*`
- [ ] Load and resilience scripts — `k6/`

> Note: Items remain unchecked until the corresponding artifacts exist. The CI verifier will fail if any artifact is absent.
