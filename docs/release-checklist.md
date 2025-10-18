# Release Checklist

Use this checklist to confirm CI quality gates, schema health, and rollout controls before promoting a release beyond canary.

## Pre-merge
- [ ] Ensure `.github/workflows/ci.yml` ran successfully for the candidate branch.
- [ ] Review lint, typecheck, unit, property, and e2e suites for stability regressions.
- [ ] Confirm `reports/test-summary.json` reports a task pass rate ≥ 0.90.
- [ ] Confirm `reports/schema-validation.json` reports validity ≥ 0.98.
- [ ] Update `prompts/changelog.md` with summary of prompt or schema changes.
- [ ] Verify any modified schemas under `schemas/` are backward compatible or versioned appropriately.

## Canary deployment
- [ ] Deploy to 10% of traffic and record `schemas/canary-metrics.schema.json`-compatible metrics.
- [ ] Monitor schema validity, task pass rate, and P95 latency for at least one observation window.
- [ ] Trigger automatic rollback if validity decreases by ≥ 0.02, task pass rate decreases by ≥ 0.03, or latency P95 increases by ≥ 30% compared to baseline.
- [ ] Document canary metrics and decisions in release notes.

## General availability
- [ ] Verify no outstanding CI failures or suppressed alerts remain.
- [ ] Confirm changelog entry references the canary results and production sign-off.
- [ ] Archive schema validation reports for auditability.
