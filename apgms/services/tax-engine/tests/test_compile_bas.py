from decimal import Decimal

import pytest

from app.bas import compileBas


@pytest.fixture
def synthetic_inputs():
    return {
        "period": "2024-03",
        "gst": {
            "sales": {
                "taxable": Decimal("18750.45"),
                "export": 1325.10,
                "other": 425.25,
            },
            "gst": {
                "collected": 1975.55,
                "credits": 845.49,
            },
        },
        "paygw": {
            "wages": {
                "gross": 9825.51,
                "withheld": 2210.50,
            }
        },
    }


def test_compile_bas_synthetic_month(synthetic_inputs):
    result = compileBas(
        synthetic_inputs["period"],
        synthetic_inputs["gst"],
        synthetic_inputs["paygw"],
    )

    assert result["period"] == synthetic_inputs["period"]
    assert result["labels"] == {
        "G1": 20501,  # 18750.45 + 1325.10 + 425.25 = 20500.80 -> 20501
        "1A": 1976,   # 1975.55 -> 1976
        "1B": 845,    # 845.49 -> 845
        "W1": 9826,   # 9825.51 -> 9826
        "W2": 2211,   # 2210.50 -> 2211
    }
    assert result["rulesVersion"] == "1.0.0"


@pytest.mark.parametrize(
    "value,expected",
    [
        (0, 0),
        (99.49, 99),
        (99.50, 100),
        (Decimal("99.50"), 100),
        (Decimal("-99.50"), -100),
        (-99.49, -99),
    ],
)
def test_rounding_matches_ato_guidance(value, expected):
    gst = {"sales": {"taxable": value, "export": 0, "other": 0}, "gst": {"collected": 0, "credits": 0}}
    paygw = {"wages": {"gross": 0, "withheld": 0}}

    compiled = compileBas("2024-05", gst, paygw)

    assert compiled["labels"]["G1"] == expected
