# Service Layer Design

This document outlines the core components that support Australian tax reporting services. Each service is separated by responsibility but designed to interoperate via well-defined interfaces and shared schema definitions.

## Overview

```
+-----------------+        +-----------------+        +-----------------+        +-----------------+
| Rules Registry  | -----> |   Calculator    | -----> |     Compiler    | -----> |    Validator    |
+-----------------+        +-----------------+        +-----------------+        +-----------------+
        ^                                                                                 |
        |                                                                                 v
   Shared storage                                                                    Outbound STP
```

* **Rules Registry** (shared library) is the single source of truth for jurisdiction- and period-specific rule packs.
* **Calculator** (tax-engine) applies rule packs to business data and produces detailed breakdowns.
* **Compiler** (BAS service) assembles module output into Business Activity Statement labels.
* **Validator** (STP2 service) enforces conformance prior to data exchange with the Australian Taxation Office (ATO).

Each layer is independently deployable and versioned so that rule updates do not require full system redeployments.

## Rules Registry

* Loads rule packs keyed by `jurisdiction` (currently `AU`), `domain` (`gst`, `paygw`, `bas`, etc.), and reporting `period`.
* Maintains an in-memory cache keyed by `(domain, period)` with the upstream `etag` to avoid redundant downloads.
* Exposes a promise-based API that returns an immutable `rulePack` object including metadata (version, etag, effective dates) to consumers.
* Emits audit events when a new pack is fetched, making cache behaviour observable.

### Data Sources

* Primary storage is a versioned object store where packs are published after validation.
* A lightweight manifest describes available packs; etag comparison prevents unnecessary transfers.
* Packs are JSON bundles containing calculator rules, label maps, and ancillary metadata.

## Calculator (tax-engine)

* Implements pure functions that accept domain inputs (e.g. ledger summaries, payroll totals) alongside the retrieved `rulePack`.
* Returns a normalized response `{ total, breakdown, labelMap }`:
  * `total`: aggregate amount for the domain (GST, PAYGW, etc.).
  * `breakdown`: per-rule computations including references to source data and diagnostic tags.
  * `labelMap`: cross-reference table for downstream compilation.
* Because functions are pure, they are deterministic and straightforward to unit test. They can be executed in isolated workers.
* Side effects (fetching rules, logging, telemetry) are handled by callers, keeping the module focused on computation.

## Compiler (BAS)

* Aggregates outputs from calculators across domains (GST, PAYGW, Fuel Tax Credits, etc.).
* Applies BAS label mappings defined in `rules/bas/labels_vN.json`. Version `N` is selected based on the reporting period and rule pack metadata.
* Executes rounding and adjustment rules contained within the mapping file, ensuring that final amounts align with ATO requirements.
* Produces the BAS payload including labels such as `1A`, `1B`, `G1`, `W1`, `W2`, along with summary statements for audit.
* Tracks provenance by attaching calculator breakdown references to each label, supporting traceability.

## Validator (STP2)

* Validates outbound Single Touch Payroll (STP) phase 2 payloads before transmission to the ATO.
* Uses JSON Schema derived from the ATO Business Implementation Guide (BIG). Schemas are versioned and bundled with the service.
* Performs validation as the final step in the publishing pipeline. On failure, the payload is rejected with actionable error diagnostics referencing the schema location.
* Successful validation is recorded with correlation identifiers, enabling replay and audit.

## Error Handling and Observability

* Each layer surfaces structured errors with machine-readable codes and human-friendly messages.
* Observability is implemented via distributed tracing: the rule pack etag and version are tagged throughout the request lifecycle.
* Metrics capture cache hit ratios, calculation latency, compilation success rates, and validation outcomes.

## Deployment Considerations

* Rules Registry is packaged as a shared library consumed by both synchronous APIs and batch jobs.
* Calculator and Compiler run as stateless services that can scale horizontally.
* Validator integrates with the outbound transport service but can also be invoked offline for pre-submission checks.
* Feature flags allow gradual rollout of new rule packs while retaining the ability to revert rapidly.

## Future Enhancements

* Introduce a rules diff API to surface changes between pack versions for operators.
* Add deterministic snapshot testing for the compiler to detect unintended mapping changes.
* Explore WebAssembly packaging for calculators to enable secure execution in constrained environments.
