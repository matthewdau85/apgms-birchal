from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_estimate_tax_basic_scenario() -> None:
    payload = {
        "tax_year": 2024,
        "residency_status": "resident",
        "filing_status": "single",
        "dependents": 1,
        "incomes": [
            {
                "source": "Acme Corp",
                "type": "salary",
                "amount": "120000",
                "withholding": "10000",
            }
        ],
        "deductions": [
            {"description": "Retirement contribution", "amount": "5000"}
        ],
        "adjustments": [
            {"description": "Low income offset", "amount": "200", "type": "credit"},
            {"description": "Medicare levy", "amount": "100", "type": "surcharge"},
        ],
    }

    response = client.post("/tax/estimate", json=payload)
    assert response.status_code == 200, response.text

    data = response.json()
    breakdown = data["breakdown"]

    assert Decimal(breakdown["taxable_income"]) == Decimal("115000.00")
    assert Decimal(breakdown["gross_tax"]) == Decimal("27842.00")
    assert Decimal(breakdown["net_tax"]) == Decimal("17742.00")
    assert Decimal(breakdown["effective_rate"]) == Decimal("0.1479")
    assert data["compliance_warnings"] == []


def test_estimate_flags_zero_income() -> None:
    payload = {
        "tax_year": 2024,
        "residency_status": "resident",
        "filing_status": "single",
        "dependents": 0,
        "incomes": [],
        "deductions": [],
        "adjustments": [],
    }

    response = client.post("/tax/estimate", json=payload)
    assert response.status_code == 200

    warnings = response.json()["compliance_warnings"]
    assert any("Total income is zero" in warning for warning in warnings)


def test_file_return_creates_submission() -> None:
    payload = {
        "taxpayer_id": "TAX123",
        "input": {
            "tax_year": 2024,
            "residency_status": "resident",
            "filing_status": "single",
            "dependents": 1,
            "incomes": [
                {
                    "source": "Acme Corp",
                    "type": "salary",
                    "amount": "75000",
                    "withholding": "5000",
                }
            ],
            "deductions": [],
            "adjustments": [],
        },
    }

    response = client.post("/tax/file", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["submission_id"] == "TAX123-2024"
    assert data["status"] == "accepted"


def test_audit_trail_returns_entries() -> None:
    payload = {
        "taxpayer_id": "TAX999",
        "input": {
            "tax_year": 2024,
            "residency_status": "resident",
            "filing_status": "single",
            "dependents": 0,
            "incomes": [
                {"source": "Side gig", "type": "business", "amount": "20000", "withholding": "0"}
            ],
            "deductions": [],
            "adjustments": [],
        },
    }

    response = client.post("/tax/audit", json=payload)
    assert response.status_code == 200

    entries = response.json()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["taxpayer_id"] == "TAX999"
    assert entry["action"] == "filed"
    assert "warnings" in entry["details"]
