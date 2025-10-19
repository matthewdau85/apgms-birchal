# Prompt Template Scaffolds

The templates in this directory define a modular prompt stack. Assemble final prompts by layering files in the following order:

1. `system.md` – establishes core role, capabilities, and operational guardrails.
2. `style.md` – constrains tone, formatting, and reusable phrasing.
3. `context.md` – injects project specifics and environmental signals.
4. `task.md` – defines the concrete work request and acceptance criteria.
5. `validator.md` – outlines how the response will be evaluated.

## Usage

1. Duplicate each template into a working location.
2. Replace every `{{placeholder}}` token with context-appropriate content.
3. Concatenate the populated segments in the order above, separating sections with blank lines.
4. Deliver the combined prompt to the assistant along with any supporting artifacts.

## Example Snippets

```markdown
# System Prompt Template
- Define the assistant's role as: **Security Release Coordinator**
- Primary capabilities: triage vulnerability reports, draft advisories, coordinate patches
```

```markdown
# Task Prompt Template
## Objective
- Summarize the end goal: Ship patched containers for CVE-XXXX-YYYY across all environments.
```

Use these scaffolds as building blocks to rapidly produce consistent, multi-layered instructions.
