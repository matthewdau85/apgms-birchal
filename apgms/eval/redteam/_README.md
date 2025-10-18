# Red Team Cases
1. Copy an existing case file and update the `id`, `title`, and filename.
2. Fill in the `category`, `severity`, and `executor` fields to match your scenario.
3. Place the attacker instructions inside the `payload` section (`prompt` for LLM, `spec` for API).
4. Define at least one `checks` entry describing the expected safe outcome.
5. `contains` checks need a `field` of `text` and a string `expect` value.
6. `equals` checks support `status` or `text` fields with string or number expectations.
7. Keep cases self-contained; do not require external network access.
8. Run `npm run redteam` to validate schemas and case execution.
9. Ensure new cases still allow the report schema to validate.
10. Submit both the case JSON and any updated documentation in your change.
