# APGMS Tax Engine

The APGMS tax engine is a FastAPI application responsible for estimating liabilities, filing
returns, and generating audit trails for compliance teams. The service exposes REST endpoints
and can be deployed as part of the broader APGMS platform.

## Application structure

```
app/
├── api/               # FastAPI routers
├── calculations.py    # Core calculation pipeline
├── main.py            # FastAPI entrypoint
├── schemas.py         # Pydantic models shared across endpoints
├── services.py        # External integrations (tax rates, filing)
└── validators.py      # Compliance validations
```

## Endpoints

| Method | Path           | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| GET    | `/health`      | Simple health probe.                          |
| POST   | `/tax/estimate`| Generate a tax estimate and compliance notes. |
| POST   | `/tax/file`    | Submit a filing request using a tax estimate. |
| POST   | `/tax/audit`   | Produce audit trail entries for a filing.     |

### Tax estimation (`POST /tax/estimate`)

Request body (`TaxInput`):

- `tax_year`: Target filing year.
- `residency_status`: `resident` or `non_resident`.
- `filing_status`: `single`, `married`, or `head_of_household`.
- `dependents`: Count of dependents.
- `incomes`: List of income streams (`source`, `type`, `amount`, `withholding`).
- `deductions`: Optional deductions (`description`, `amount`).
- `adjustments`: Credits or surcharges applied post-calculation.

Response (`TaxEstimate`): provides the computed breakdown (taxable income, gross/net tax,
credits, surcharges, and effective rate) as well as any compliance warnings triggered during
validation.

### Filing (`POST /tax/file`)

Request body (`FilingSubmission`) includes a `taxpayer_id` alongside the `TaxInput`. The
endpoint internally creates a `TaxEstimate`, persists it using the `FilingService`, and returns a
`FilingResponse` with submission metadata.

### Audit trail (`POST /tax/audit`)

Accepts the same structure as filing but returns a list of `AuditLogEntry` records that can be
stored in downstream compliance systems.

## Tax rate integration

`TaxRateService` retrieves tax brackets from an upstream Prisma-backed API (configured via the
`TAX_RATE_SERVICE_URL` environment variable). When the variable is unset the service falls back to
an in-memory schedule suitable for local development and unit tests.

## Running locally

1. Install dependencies using Poetry: `poetry install`
2. Run the API: `poetry run uvicorn app.main:app --reload`
3. Execute the test suite: `poetry run pytest`

The FastAPI application also publishes an OpenAPI document at `/openapi.json` and interactive
Swagger UI at `/docs` once the server is running.
