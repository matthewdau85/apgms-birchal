# Release Hardening Checklist

## P0 — Must Complete Before Code Freeze
- [ ] Confirm the release branch is cut from the latest `main` and tagged.
- [ ] Communicate the release freeze to all teams and halt feature merges.
- [ ] Triage open P0 bugs and assign owners with clear ETAs.
- [ ] Run the smoke validation suite (see commands below) and attach logs to the tracker.
- [ ] Review rollback readiness, including automation scripts and access tokens.

## P1 — Required Before Final Sign-off
- [ ] Audit release notes for accuracy, localization, and linked tickets.
- [ ] Verify observability dashboards cover all new features and SLO alerts are green.
- [ ] Confirm infra and data migrations have run successfully in staging.
- [ ] Validate support, GTM, and docs teams have acknowledged launch dependencies.

## P2 — Nice-to-Have Prior to Launch
- [ ] Archive resolved tickets and update the launch epic with final statuses.
- [ ] Capture test coverage deltas and flag areas needing follow-up hardening.
- [ ] Schedule post-launch retrospective and invite cross-functional owners.
- [ ] Circulate release announcement draft for final stakeholder review.

## Smoke Test Commands
Run all commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test --project=chromium --grep @smoke
```
