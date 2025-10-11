from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_api_returns_traceability_metadata():
    response = client.post(
        "/paygw/calculate",
        json={
            "gross_income": "650",
            "bas_period_start": date(2024, 7, 1).isoformat(),
            "rule_pack_version": "2024.1",
        },
    )
    payload = response.json()
    assert response.status_code == 200
    metadata = payload["result"]
    for key in ("ruleset_id", "effective_from", "source_url", "source_digest"):
        assert key in metadata
    assert Decimal(metadata["withheld_amount"]) >= Decimal("0")
