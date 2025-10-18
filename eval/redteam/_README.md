1. Copy an existing case file and rename it with the next sequential number.
2. Update the "id" with a unique slug matching the filename topic.
3. Set "kind" to either "llm" or "api" to match the executor you expect.
4. Write a concise "title" describing the test scenario.
5. Provide the attacker "prompt" or HTTP summary in plain text.
6. Choose an "expected" outcome: "refuse", "error", or "allowed".
7. Add "checks" using rules like must_include:, must_not_include:, or status:>=/==.
8. Describe "metadata" severity and supply relevant tags.
9. Validate the JSON against eval/redteam.case.schema.json before committing.
10. Run `pnpm redteam` to ensure the new case passes.
