from datetime import date

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_gst_calc_basic():
    payload = {
        "period_due_date": "2024-03-31",
        "supplies": [
            {"date": "2024-01-10", "amount_cents": 10000, "gst_cents": 1000, "tax_code": "TX"},
            {"date": "2024-01-15", "amount_cents": 2000, "gst_cents": 0, "tax_code": "FRE"},
        ],
        "purchases": [
            {"date": "2024-01-20", "amount_cents": 3000, "gst_cents": 300, "tax_code": "TX"},
            {"date": "2024-01-22", "amount_cents": 1000, "gst_cents": 0, "tax_code": "NT"},
        ],
        "adjustments": [
            {"amount_cents": 500, "gst_cents": 100, "tax_code": "ADJ"}
        ],
    }
    response = client.post("/gst/calc", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["g1"] == 125
    assert data["g2"] == 20
    assert data["g10"] == 30
    assert data["g11"] == 40
    assert data["1A"] == 11
    assert data["1B"] == 3
    assert data["net_payable"] == 8


def test_paygw_calc_basic():
    payload = {
        "period_due_date": "2024-03-31",
        "pay_events": [
            {"date": "2024-01-15", "gross_cents": 20000, "withheld_cents": 4200, "stsl_cents": 300},
            {"date": "2024-02-15", "gross_cents": 18000, "withheld_cents": 3800, "stsl_cents": 0},
        ],
    }
    response = client.post("/paygw/calc", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["W1"] == 380
    assert data["W2"] == 83
    assert data["metadata"]["events_count"] == 2


def test_bas_compile_combines_results():
    payload = {
        "period": {"id": "period-1", "label": "2024Q1", "dueDate": "2024-03-31"},
        "gst": {
            "period_due_date": "2024-03-31",
            "supplies": [
                {"date": "2024-01-10", "amount_cents": 10000, "gst_cents": 1000, "tax_code": "TX"}
            ],
            "purchases": [
                {"date": "2024-01-12", "amount_cents": 3000, "gst_cents": 300, "tax_code": "TX"}
            ],
            "adjustments": [],
        },
        "paygw": {
            "period_due_date": "2024-03-31",
            "pay_events": [
                {"date": "2024-01-15", "gross_cents": 22000, "withheld_cents": 4300, "stsl_cents": 0}
            ],
        },
    }

    response = client.post("/bas/compile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["gst"]["1A"] == 10
    assert data["paygw"]["W2"] == 43
    assert data["bas"]["net_payable"] == 53
