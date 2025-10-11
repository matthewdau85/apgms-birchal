# Platform Architecture Overview

This document provides C4-style architecture views for the APGMS platform. Each diagram uses [Mermaid](https://mermaid.js.org/) syntax and can be rendered by static site generators that support Mermaid (e.g. MkDocs, Docusaurus).

## Level 1: System Context

```mermaid
C4Context
    title APGMS Platform Context
    Boundary(actor_customer, "Customers") {
        Person(customer, "Business Customer", "Uses the platform to manage guarantees and mandates")
    }
    Person(psm, "Platform Support Manager", "Operates the platform and responds to incidents")

    System(apgms, "APGMS Platform", "Digital management of bank guarantees and mandates")

    System_Ext(banks, "Partner Banks", "Issue and settle guarantees")
    System_Ext(regulators, "Regulators", "Receive compliance reporting")
    System_Ext(notification, "Notification Service", "Delivers email/SMS updates")

    Rel(customer, apgms, "Creates and tracks guarantees")
    Rel(psm, apgms, "Operates and configures")
    Rel(apgms, banks, "API-based guarantee issuance")
    Rel(apgms, regulators, "Regulatory reports")
    Rel(apgms, notification, "Event notifications")
```

## Level 2: Container View

```mermaid
C4Container
    title APGMS Platform Containers
    Person(customer, "Business Customer")
    Person(psm, "Platform Support Manager")

    System_Boundary(apgms, "APGMS Platform") {
        Container(web, "Customer Portal", "Next.js", "Self-service experience for customers")
        Container(api, "API Gateway", "Node.js", "Unified API surface for external and internal clients")
        Container_Boundary(services, "Domain Microservices") {
            Container(audit, "Audit Service", "Node.js", "Immutable event log and reporting")
            Container(payments, "Payments Service", "Node.js", "Settlement and reconciliation")
            Container(registries, "Registries Service", "Node.js", "Reference and compliance data")
        }
        Container(db, "Operational Data Store", "PostgreSQL", "Authoritative state for mandates and guarantees")
        Container(queue, "Message Bus", "Kafka", "Asynchronous events between services")
        Container(obs, "Observability Stack", "Grafana/Prometheus", "Metrics, logs and tracing")
    }

    Rel(customer, web, "Uses")
    Rel(web, api, "HTTPS/JSON")
    Rel(api, services, "gRPC/REST")
    Rel(services, db, "SQL")
    Rel(services, queue, "Event streaming")
    Rel(queue, services, "Async events")
    Rel(psm, obs, "Monitoring & alerting")
```

## Level 3: Component View — API Gateway

```mermaid
C4Component
    title API Gateway Components
    Container(api, "API Gateway", "Node.js")

    Component(router, "Routing Layer", "Express", "Routes requests and applies authentication")
    Component(orchestration, "Orchestration", "TypeScript", "Aggregates calls across services")
    Component(policy, "Policy Enforcement", "Open Policy Agent", "Applies access control and rate limits")
    Component(adapter, "Service Adapters", "TypeScript", "Translate gateway requests into service-specific calls")
    Component(observability, "Telemetry", "OpenTelemetry", "Captures metrics and traces")

    Rel(router, orchestration, "Delegates validated requests")
    Rel(orchestration, adapter, "Invokes service integrations")
    Rel(policy, router, "Authorisation decisions")
    Rel(router, observability, "Emits spans/metrics")
    Rel(adapter, observability, "Emit service timings")
```

## Architectural Decision Log

| Decision | Rationale | Status |
| --- | --- | --- |
| Adopt microservices per bounded context | Enables independent scaling and deployments | Accepted |
| Use Kafka for asynchronous integration | Decouples services and improves resilience | Accepted |
| Centralise observability with OpenTelemetry | Provides consistent telemetry across services | Accepted |

