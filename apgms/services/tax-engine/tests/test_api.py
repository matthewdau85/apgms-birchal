from typing import Tuple

import pytest
from fastapi.testclient import TestClient

from app import main
from app.services import TaxEngineService


class FakeSBRClient:
    def __init__(self) -> None:
        self.submissions: list[dict] = []

    async def submit_liability(self, payload):  # pragma: no cover - simple passthrough
        self.submissions.append(payload)
        return {"status": "accepted", **payload}


@pytest.fixture()
def client() -> Tuple[TestClient, FakeSBRClient]:
    fake_client = FakeSBRClient()
    service = TaxEngineService(fake_client)
    main.get_tax_service.cache_clear()
    main.app.dependency_overrides[main.get_tax_service] = lambda: service
    with TestClient(main.app) as test_client:
        yield test_client, fake_client
    main.app.dependency_overrides.clear()


def test_compute_gst_liability_endpoint(client):
    test_client, _ = client
    response = test_client.post(
        "/gst/liability",
        json={
            "gst_collected": "15000.00",
            "gst_paid": "12000.00",
            "adjustments": "500.00",
            "credits": "200.00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["liability"] == "3300.00"
    assert body["breakdown"]["gst_paid"] == "-12000.00"


def test_compute_payg_liability_endpoint(client):
    test_client, _ = client
    response = test_client.post(
        "/payg/liability",
        json={
            "gross_wages": "80000.00",
            "withholding_rate": "0.325",
            "instalment_credits": "10000.00",
            "other_adjustments": "500.00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["liability"] == "16500.00"
    assert body["breakdown"]["withholding_due"] == "26000.00"


def test_gateway_validation_without_submission(client):
    test_client, fake_client = client
    response = test_client.post(
        "/gateway/validate",
        json={
            "product": "PAYG",
            "submission_id": "SUB-1",
            "submit": False,
            "payload": {
                "gross_wages": "50000.00",
                "withholding_rate": "0.3",
                "instalment_credits": "5000.00",
                "other_adjustments": "0.00",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["submitted"] is False
    assert fake_client.submissions == []


def test_gateway_validation_with_submission_triggers_sbr(client):
    test_client, fake_client = client
    response = test_client.post(
        "/gateway/validate",
        json={
            "product": "GST",
            "submission_id": "SUB-2",
            "submit": True,
            "payload": {
                "gst_collected": "12000.00",
                "gst_paid": "6000.00",
                "adjustments": "0.00",
                "credits": "0.00",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["submitted"] is True
    assert len(fake_client.submissions) == 1
    submission = fake_client.submissions[0]
    assert submission["submissionId"] == "SUB-2"
    assert submission["product"] == "GST"
    assert submission["liability"] == "6000.00"
