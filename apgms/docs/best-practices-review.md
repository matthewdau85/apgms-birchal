# Best Practice Review

## Scope
This review covers the public API surface that exists in `services/api-gateway` and the shared Prisma data-access layer as of this commit. It benchmarks the implementation against broadly accepted web-service best practices for TypeScript/Fastify services.

## Strengths
- **Shared database client** – The code centralises Prisma access in `shared/src/db.ts`, reducing the risk of duplicating connection logic across services.【F:apgms/shared/src/db.ts†L1-L3】
- **Basic operational hooks** – The Fastify server configures logging and CORS and exposes a `/health` probe, which aligns with standard operational readiness practices.【F:apgms/services/api-gateway/src/index.ts†L14-L24】

## Gaps and Risks
1. **Configuration handling**  
   The gateway manually resolves the repository-root `.env` file from deep inside the service directory. This tightly couples the runtime to the repo layout and bypasses Twelve-Factor recommendations to source configuration purely from the environment.【F:apgms/services/api-gateway/src/index.ts†L5-L9】
2. **Sensitive-data logging**  
   Logging the full `DATABASE_URL` risks exposing credentials in log aggregation systems. Best practice is to avoid logging secrets or to redact them before emitting logs.【F:apgms/services/api-gateway/src/index.ts†L18-L20】
3. **Lack of request validation**  
   Route handlers cast `req.query` and `req.body` to `any`-compatible shapes and trust their structure without schema validation. This can allow malformed requests through and defers type errors to runtime database failures. Introducing schema validation (e.g., with Zod, already a dependency) would enforce contracts and return informative 4xx responses early.【F:apgms/services/api-gateway/src/index.ts†L33-L59】
4. **Broad error responses**  
   The POST handler converts all errors into a generic `400 bad_request`, obscuring database or validation issues and making debugging difficult. Differentiated error handling (e.g., 422 for validation vs. 500 for server errors) improves observability and client ergonomics.【F:apgms/services/api-gateway/src/index.ts†L42-L66】
5. **Testing coverage**  
   Automated tests are effectively absent; the shared package contains only a placeholder and the API gateway exposes an empty `test` folder. Establishing unit/integration tests for handlers and data access is essential for regression protection.【F:apgms/shared/test/index.test.ts†L1-L2】【F:apgms/services/api-gateway/test/.gitkeep†L1-L1】
6. **Developer tooling**  
   The workspace `package.json` exposes build and test scripts but no linting, formatting, or type-check convenience commands. Incorporating lint/format scripts (and wiring them into CI) enforces consistent coding style and catches issues before runtime.【F:apgms/package.json†L1-L7】

## Recommendations
- Load configuration exclusively through environment variables or a central configuration module and ensure the runtime fails fast when required values are missing.
- Remove or redact credential-bearing data from logs; prefer structured logging with safe metadata.
- Introduce request schemas (e.g., Zod) and integrate them with Fastify's validation hooks to guarantee payload shape and types.
- Differentiate between validation, client, and server errors to return precise HTTP status codes and improve observability.
- Build out automated test suites for routing, Prisma interactions, and shared utilities, and integrate them into CI.
- Add linting/formatting scripts (ESLint, Prettier) and type-check commands at the workspace root to standardise developer workflows.
