from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import ReconciliationRequest, TaxType


def test_event_processing_and_reconciliation() -> None:
    with TestClient(app) as client:
        payroll_payload = {
            "employer_id": "EMP-001",
            "employee_id": "E-123",
            "gross_pay": "2500.00",
            "pay_period_ending": "2023-06-30",
        }
        response = client.post("/events/payroll", json=payroll_payload)
        assert response.status_code == 202

        pos_payload = {
            "business_id": "EMP-001",
            "sale_amount": "220.00",
            "gst_free": False,
        }
        response = client.post("/events/pos", json=pos_payload)
        assert response.status_code == 202

        flush_response = client.post("/events/flush")
        assert flush_response.status_code == 200

        obligations_response = client.get("/obligations")
        assert obligations_response.status_code == 200
        obligations = obligations_response.json()["obligations"]
        assert len(obligations) == 2

        paygw_snapshot = next(
            snap for snap in obligations if snap["tax_type"] == TaxType.PAYGW.value
        )
        gst_snapshot = next(
            snap for snap in obligations if snap["tax_type"] == TaxType.GST.value
        )

        assert paygw_snapshot["entity_id"] == "EMP-001"
        assert Decimal(paygw_snapshot["total_amount"]) > Decimal("0")
        assert gst_snapshot["entity_id"] == "EMP-001"
        assert Decimal(gst_snapshot["total_amount"]) == Decimal("20.00")

        request = ReconciliationRequest(
            account_balances=[
                {
                    "entity_id": "EMP-001",
                    "tax_type": TaxType.PAYGW,
                    "balance": Decimal(paygw_snapshot["total_amount"]),
                },
                {
                    "entity_id": "EMP-001",
                    "tax_type": TaxType.GST,
                    "balance": Decimal("20.00"),
                },
            ]
        )
        reconcile_response = client.post(
            "/reconcile", json=request.model_dump(mode="json")
        )
        assert reconcile_response.status_code == 200
        assert reconcile_response.json()["discrepancies"] == []

        mismatched_request = ReconciliationRequest(
            account_balances=[
                {
                    "entity_id": "EMP-001",
                    "tax_type": TaxType.PAYGW,
                    "balance": Decimal("0"),
                }
            ]
        )
        mismatch_response = client.post(
            "/reconcile", json=mismatched_request.model_dump(mode="json")
        )
        assert mismatch_response.status_code == 200
        discrepancies = mismatch_response.json()["discrepancies"]
        assert len(discrepancies) == 1
        assert discrepancies[0]["tax_type"] == TaxType.PAYGW.value

        discrepancy_list_response = client.get("/discrepancies")
        assert discrepancy_list_response.status_code == 200
        assert len(discrepancy_list_response.json()["discrepancies"]) >= 1
