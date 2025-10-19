# Card A – Hallucination Control

## Symptoms
- Model invents product capabilities or partners not present in repo documentation.
- References internal services that do not exist or contradict CODEOWNERS guidance.
- Provides speculative code paths or API endpoints during user interactions.

## Triggers
- Responses contain phrases like "assume", "probably", or fabricated module names.
- PR summaries introduce features not backed by diff evidence.
- Reviewers flag more than one hallucination in a single sprint.

## Actions
- Pause delivery and cross-check claims against repo search results.
- Require source-linked citations for every non-trivial statement.
- Add regression prompts focusing on fact verification before finalizing output.

## Escalation
- Notify the Prompt QA rotation when hallucinations persist after remediation.
- Escalate to Documentation PM if hallucinations block release milestones.

## Owner
- Documentation QA Lead (currently Jamie Chen).

---

# Card B – Format Integrity

## Symptoms
- Deliverables omit mandated sections (e.g., Summary, Testing).
- Markdown tables or lists render incorrectly in the documentation portal.
- JSON prompts fail schema validation in downstream tooling.

## Triggers
- CI documentation linter fails due to structural issues.
- Stakeholders report unreadable formatting within 24 hours of publication.
- Automated tests detect missing front matter or headings.

## Actions
- Run markdownlint and formatters on updated docs.
- Regenerate artifacts using the documented CLI with --strict flag.
- Pair review with Technical Writer to confirm template adherence.

## Escalation
- Alert Docs Release Manager if format defects recur for two consecutive releases.
- Create an incident ticket when format failure blocks downstream automation.

## Owner
- Documentation Operations Specialist (Priya Natarajan).

---

# Card C – Cost Overrun

## Symptoms
- Prompt executions exceed budgeted token consumption for planned workflows.
- Billing dashboard shows a 15% week-over-week cost increase without scope change.
- Engineers throttle usage due to rate-limit warnings tied to cost control policies.

## Triggers
- Daily cost report crosses $250 above forecast.
- Any single prompt template grows by more than 40% token footprint after edits.
- Finance flags overage risk ahead of monthly close.

## Actions
- Audit prompts for unnecessary context windows or redundant retrieval steps.
- Implement caching or response truncation based on usage analytics.
- Coordinate with ML Ops to adjust temperature and max token defaults.

## Escalation
- Notify Finance Partner when forecast variance persists for three days.
- Escalate to Head of Platform if cost mitigation requires production throttle.

## Owner
- Prompt Lifecycle Program Manager (Alex Romero).

---

# Card D – Accuracy Regression

## Symptoms
- Evaluation harness shows statistically significant drop in answer correctness.
- Support tickets referencing incorrect instructions increase by 20%.
- Golden test prompts fail during nightly regression suite.

## Triggers
- Eval accuracy falls below 92% on the core benchmark set.
- More than five customer incidents in a week trace back to prompt outputs.
- Any change request removes previously required verification steps.

## Actions
- Revert to last known good prompt version while investigation proceeds.
- Add targeted unit prompts focusing on the failing intents.
- Schedule cross-functional review with SMEs to validate revised content.

## Escalation
- Engage Incident Commander if accuracy regression impacts production SLA.
- Escalate to VP of Product when contractual accuracy thresholds are threatened.

## Owner
- Applied Research Evaluations Lead (Morgan Patel).

---

# Card E – Safety Compliance

## Symptoms
- Generated content violates safety guardrails or policy redlines.
- Red-team tests expose unmitigated pathways to disallowed content.
- Legal or Trust teams report regulatory exposure linked to prompt outputs.

## Triggers
- Safety classifier flags exceed 0.5% of total volume in a rolling 48-hour window.
- Any P0 or P1 incident involving user harm or policy violation surfaces.
- Red-team exercises uncover a new exploit vector in released prompts.

## Actions
- Immediately disable the affected prompt or route traffic through fallback guardrails.
- Apply policy-compliant filters and add explicit refusal patterns.
- Run a targeted safety eval suite before re-enabling the workflow.

## Escalation
- Notify Trust & Safety Duty Officer within one hour of confirmed violation.
- Escalate to Legal Counsel if regulatory reporting thresholds are met.

## Owner
- Trust & Safety Prompt Steward (Dana Okafor).

