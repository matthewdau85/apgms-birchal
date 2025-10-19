# Prompt Pattern Decision Tree

Use this decision tree to choose among the five supported prompt patterns. Work through Questions 1–4 in order; branch according to the answers. Apply fallback rules if no branch cleanly fits or if runtime feedback indicates a switch.

## Decision Tree

1. **Is the request primarily about locating or summarizing facts from provided or known corpora?**  
   - **Yes → Go to Q2.**  
   - **No → Go to Q3.**
2. **Do you have a well-structured source (tables, forms, logs) that maps directly to answer fields?**  
   - **Yes → Choose the _Extractor_ pattern.**  
   - **No → Choose the _RAG_ pattern** (retrieve, cite, and synthesize from broader unstructured data).
3. **Is the task interactive, requiring API usage, calculations, or external systems?**  
   - **Yes → Choose the _Tools_ pattern** (function calling or integrations).  
   - **No → Go to Q4.**
4. **Is the task multi-step with branching reasoning or planning required before responding?**  
   - **Yes → Choose the _Planner_ pattern** (produce a plan, then execute).  
   - **No → Choose the _Creative_ pattern** (open-ended generation, ideation, tone control).

## Fallback Rules

- **Ambiguous data access:** If the chosen pattern cannot access necessary context, fall back to _RAG_ and pair with a minimal retrieval set.  
- **Unexpected tool errors:** If tools fail repeatedly, revert to _Planner_ to reason through manual steps or to _Creative_ for advisory guidance.  
- **Low confidence extractions:** When _Extractor_ outputs contain gaps, retry with _RAG_ to gather supporting text and confirm values.  
- **Overly complex creative briefs:** When _Creative_ responses require sequencing or constraints, escalate to _Planner_ to structure the workflow.  
- **Tight latency budgets:** Prefer _Extractor_ or _Creative_; fall back from _RAG_ or _Planner_ if retrieval or planning overhead breaches latency targets.

## Pattern Guide

### Extractor
- **Pros:** Fast, deterministic slot-filling; minimal tokens; high precision on structured inputs.  
- **Cons:** Brittle with ambiguous or sparse data; hallucination risk when fields are missing.  
- **Switch when:** Source becomes unstructured → move to _RAG_; repeated "N/A" outputs → pair with _RAG_ for verification.
- **Hallucination check:** Confirm each field maps to explicit source lines; flag any inferred values; log confidence per field.  
- **Cost/latency check:** Ensure prompt uses concise schema-only instructions; cap retries to avoid loops.

### RAG
- **Pros:** Handles large, unstructured corpora; supports citations and provenance.  
- **Cons:** Higher latency from retrieval; risk of outdated indexes; may surface irrelevant chunks.  
- **Switch when:** Retrieval results are empty or noisy → tighten filters or fall back to _Creative_ summary; latency budgets exceeded → try _Extractor_.
- **Hallucination check:** Require citations for every factual claim; monitor retrieval hit rate; run spot-check on chunk relevance.  
- **Cost/latency check:** Limit retrieved chunks; cache embeddings; reuse conversation memory.

### Tools
- **Pros:** Enables calculations, API lookups, and workflow automation; allows delegation to specialized services.  
- **Cons:** Tool failures cascade; adds coordination overhead; security review needed.  
- **Switch when:** Tool schema unavailable → pivot to _Planner_; repeated failures → degrade gracefully to advisory _Creative_ answer.  
- **Hallucination check:** Validate tool outputs before final response; confirm arguments conform to schema; capture error codes.  
- **Cost/latency check:** Batch tool calls; reuse session tokens; set timeout guards.

### Planner
- **Pros:** Structures complex tasks; supports decomposition, parallelism, and validation; good for compliance workflows.  
- **Cons:** Multi-turn overhead; susceptible to compounding errors; longer latency.  
- **Switch when:** Task simplifies → drop to _Extractor_ or _Creative_; plan becomes repetitive → collapse into single-step _Tools_ invocation.  
- **Hallucination check:** Verify each plan step references available capabilities; confirm execution results match plan; maintain audit log.  
- **Cost/latency check:** Limit plan depth; reuse partial plans; stop once success criteria met.

### Creative
- **Pros:** Flexible tone and style control; excels at brainstorming and narrative tasks; fastest setup.  
- **Cons:** Highest hallucination risk; lacks factual grounding; limited to internal knowledge.  
- **Switch when:** User needs citations → escalate to _RAG_; workflow requires structure → move to _Planner_; factual accuracy demanded → use _Extractor_/_RAG_.  
- **Hallucination check:** Insert self-review step to question factual claims; request user validation; favor disclaimers for uncertain facts.  
- **Cost/latency check:** Use lightweight prompts; impose token ceilings; avoid unnecessary system messages.

