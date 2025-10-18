1. Copy an existing case file and rename it with the next sequential id.
2. Update the id field to match the filename (e.g., 04_newcase).
3. Provide a concise title describing the exploit attempt.
4. Document the threat scenario in the description field.
5. Choose the executor: "llm" for prompts or "api" for external calls.
6. Supply the prompt or API spec string needed for reproduction.
7. List one or more checks describing the expected safe behavior.
8. Use contains/not_contains checks for text and status_equals for APIs.
9. Validate against redteam.case.schema.json before committing.
10. Run `npm run redteam` to confirm the case and report pass.
