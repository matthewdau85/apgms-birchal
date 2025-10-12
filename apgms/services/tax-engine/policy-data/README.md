# Policy fixtures

These fixtures provide sample ATO policy extracts used to drive deterministic tests.
They are reduced representations sourced from public instructions and are annotated with
provenance metadata inside each JSON file via the `source` property. Thresholds are
stored separately in CSV to reflect the layout of published withholding tables.

The data is static and versioned by effective date. The `StubPolicyUpdater` in the
service provides a placeholder for wiring in real scraping/ETL logic in future updates.
