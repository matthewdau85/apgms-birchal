# Intake Triage Guide

## Core Questions

- **Outcome**  
  `Outcome: _________________________________________________`  
  _Example_: `Green-light onboarding workflow updates for pilots.`
- **Evidence**  
  `Evidence: ________________________________________________`  
  _Example_: `Customer interviews, funnel metrics, QA reports.`
- **Risk**  
  `Risk: ____________________________________________________`  
  _Example_: `High operational impact if SLAs slip beyond 24h.`
- **Budget**  
  `Budget: _________________________________________________`  
  _Example_: `Max 40 engineering hours, $15k vendor spend.`
- **Audit**  
  `Audit: __________________________________________________`  
  _Example_: `Privacy review required; log retention policy update.`

## Decision Rules

- **Schema vs. headings**: use structured schema when downstream automation requires field-level parsing; otherwise provide heading-based narrative.
- **RAG/tooling triggers**: enable retrieval-augmented generation or external tools when evidence spans multiple systems or fresh data is critical.
- **Red-team trigger**: invoke red-team review for high-risk outcomes (safety, compliance, reputation) or when unresolved risks exceed medium severity.

---

## One-Page Triage Template

**Project / Request**

- Outcome: _________________________________________________
- Evidence: ________________________________________________
- Risk: ____________________________________________________
- Budget: _________________________________________________
- Audit: __________________________________________________

**Decision Notes**

- Schema vs. headings: _____________________________________
- RAG / tools needed: ______________________________________
- Red-team needed: ________________________________________

**Approvals & Next Steps**

- Decision owner: _________________________________________
- Follow-up actions: _______________________________________
- Review date: ____________________________________________
