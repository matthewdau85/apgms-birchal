.PHONY: lint test serve openapi

lint:
poetry run ruff check tax_engine tests

test:
poetry run pytest

serve:
poetry run uvicorn tax_engine.app:create_app --factory --host 0.0.0.0 --port 8000

openapi:
poetry run tax-engine-export-openapi openapi.json
