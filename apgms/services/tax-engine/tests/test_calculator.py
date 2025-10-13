from datetime import date
from decimal import Decimal

import pytest

from app.alerts import OpsAlertRequired, require_ops_alert_for_paygw_change
from app.calculator import calculate_paygw
from app.main import CalculationResponse, HTTPException, app
from app.rounding import round_currency
from app.rule_loader import RuleLoader


def test_calculation_is_deterministic():
    inputs = {"income": Decimal("5000"), "deductions": Decimal("0")}
    result_one = calculate_paygw(inputs=inputs, rule_pack_version="2023-07", bas_period_start=date(2023, 7, 1))
    result_two = calculate_paygw(inputs=inputs, rule_pack_version="2023-07", bas_period_start=date(2023, 7, 1))
    assert result_one.paygw_withheld == result_two.paygw_withheld
    assert result_one.ruleset == result_two.ruleset

    result_new = calculate_paygw(inputs=inputs, rule_pack_version="2024-07", bas_period_start=date(2024, 7, 1))
    assert result_new.paygw_withheld != result_one.paygw_withheld


def test_backdating_blocks_latest_ruleset():
    loader = RuleLoader()
    with pytest.raises(ValueError):
        loader.load_ruleset(rule_pack_version="latest", bas_period_start=date(2023, 12, 1))


@pytest.mark.parametrize(
    "amount, expected",
    [
        (Decimal("0.024"), Decimal("0.00")),
        (Decimal("0.025"), Decimal("0.05")),
        (Decimal("0.074"), Decimal("0.05")),
        (Decimal("0.075"), Decimal("0.10")),
    ],
)
def test_rounding_is_centralised(amount: Decimal, expected: Decimal):
    assert round_currency(amount) == expected


def test_api_returns_traceable_payload():
    payload = {
        "income": "6000",
        "deductions": "0",
        "rule_pack_version": "2023-07",
        "bas_period_start": "2023-07-15",
    }
    response = app.handle("POST", "/calculate", payload)
    assert isinstance(response, CalculationResponse)
    assert response.ruleset_id == "2023-07"
    assert response.source_url
    assert response.source_digest

    health_response = app.handle("GET", "/health")
    assert health_response.ruleset_id == "2024-07"
    assert health_response.source_url
    assert health_response.source_digest


def test_api_rejects_invalid_payload():
    with pytest.raises(HTTPException):
        app.handle("POST", "/calculate", {"income": "100"})


def test_paygw_updates_require_ops_alert():
    previous = [{"threshold": 0, "rate": Decimal("0.19")}]
    proposed = [{"threshold": 0, "rate": Decimal("0.20")}]

    with pytest.raises(OpsAlertRequired):
        require_ops_alert_for_paygw_change(
            previous_brackets=previous,
            proposed_brackets=proposed,
            alert_opened=False,
        )

    # No exception when alert has been opened and acknowledged.
    require_ops_alert_for_paygw_change(
        previous_brackets=previous,
        proposed_brackets=proposed,
        alert_opened=True,
    )
