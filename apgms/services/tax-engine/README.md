# Tax engine operations

## Rule update workflow

1. Product or compliance teams log the legislative change in Linear with the relevant ATO reference and desired effective date.
2. A tax analyst updates the JSON schedule in `app/data/` on a feature branch, pairing with engineering for peer review.
3. Run `poetry run pytest` to execute property-based boundary tests and confirm the regression suite passes.
4. Submit the pull request including the updated evidence pack (`docs/rules/<year>-<change>.md`).
5. Once merged, the release pipeline promotes the new schedule to staging, runs batch performance profiling via `scripts/profile_rules.sh`, and awaits sign-off from tax and compliance.
6. Production rollout occurs behind a feature flag with automated canary comparisons between the previous and new schedule for 24 hours.

## Performance profiling

Batch profiling is executed weekly using anonymised sample files from the analytics warehouse. Results are stored in `status/tax-engine/benchmarks.md` to ensure response times stay within the 400ms SLO defined in the ops runbook.
