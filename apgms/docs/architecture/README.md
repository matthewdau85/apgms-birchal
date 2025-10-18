# Architecture Documentation Roadmap

## Deliverables
- System context diagram highlighting user channels, external regulators, and partner integrations.
- Container diagram detailing microservices (`api-gateway`, `payments`, `tax-engine`, etc.) and shared infrastructure (databases, message buses).
- Component diagrams per critical service (e.g., tax calculation pipeline, reconciliation workflows).
- Deployment topology across environments (dev, staging, prod) including observability stack.

## Sources
- Service definitions under `apgms/services/` and shared modules under `apgms/shared/`.
- Infrastructure code under `apgms/infra/`.
- Patent specification references (pending legal approval).

## Next Steps
1. Collect up-to-date architecture decisions (ADRs) from engineering leads.
2. Choose diagram-as-code tooling (Structurizr, C4-PlantUML, or Diagrams.net) and store under `apgms/docs/architecture/diagrams/`.
3. Automate diagram generation in CI once pipeline is in place.
4. Link diagrams to corresponding sections in the runbooks and traceability matrix.

> **Status:** Documentation scaffolding created; diagrams to be produced in subsequent iterations.
