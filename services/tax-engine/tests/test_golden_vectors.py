"""Golden vector tests for tax engine endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tax_engine.app import create_app
from tax_engine.openapi import export_schema

client = TestClient(create_app())


def test_gst_standard_category() -> None:
    response = client.post(
        "/gst/calc",
        json={"net_amount": 1000.0, "category": "standard"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["gst_amount"] == 100.0
    assert payload["gross_amount"] == 1100.0
    assert payload["rule_version"] == "2024-07-01"


def test_paygw_tier_transition() -> None:
    response = client.post(
        "/paygw/calc",
        json={"taxable_income": 7500.0, "allowances": 200.0},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["withheld_amount"] == 1400.0
    assert payload["applicable_rate"] == 0.2
    assert payload["rule_version"] == "2024-07-01"


def test_bas_net_payable() -> None:
    response = client.post(
        "/bas/compile",
        json={
            "gst_collected": 1500.0,
            "gst_paid": 500.0,
            "paygw_withheld": 2000.0,
            "paygw_credits": 300.0,
            "fuel_tax_credit": 100.0,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["totals"]["gst_payable"] == 1000.0
    assert payload["totals"]["paygw_payable"] == 1700.0
    assert payload["totals"]["net_payable"] == 2600.0
    assert payload["rule_version"] == "2024-07-01"


def test_openapi_export_lists_endpoints(tmp_path) -> None:
    schema_path = tmp_path / "openapi.json"
    export_schema(schema_path)
    data = schema_path.read_text(encoding="utf-8")
    assert "/gst/calc" in data
    assert "/paygw/calc" in data
    assert "/bas/compile" in data
