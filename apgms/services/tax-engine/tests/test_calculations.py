from decimal import Decimal

import pytest

from app.calculations import (
    CalculationError,
    GSTCalculationData,
    GSTCalculator,
    PAYGCalculationData,
    PAYGCalculator,
)


def test_gst_calculation_net_tax():
    data = GSTCalculationData(
        gst_collected=Decimal("15000.00"),
        gst_paid=Decimal("12000.00"),
        adjustments=Decimal("500.00"),
        credits=Decimal("200.00"),
    )
    result = GSTCalculator().calculate(data)
    assert result.liability == Decimal("3300.00")
    assert result.breakdown == {
        "gst_collected": Decimal("15000.00"),
        "gst_paid": Decimal("-12000.00"),
        "adjustments": Decimal("500.00"),
        "credits": Decimal("-200.00"),
    }


def test_payg_calculation_withholding():
    data = PAYGCalculationData(
        gross_wages=Decimal("80000.00"),
        withholding_rate=Decimal("0.325"),
        instalment_credits=Decimal("10000.00"),
        other_adjustments=Decimal("500.00"),
    )
    result = PAYGCalculator().calculate(data)
    assert result.liability == Decimal("16500.00")
    assert result.breakdown == {
        "withholding_due": Decimal("26000.00"),
        "instalment_credits": Decimal("-10000.00"),
        "other_adjustments": Decimal("500.00"),
    }


def test_negative_values_raise_errors():
    with pytest.raises(CalculationError):
        GSTCalculationData(gst_collected=Decimal("-1"), gst_paid=Decimal("0"))

    with pytest.raises(CalculationError):
        PAYGCalculationData(gross_wages=Decimal("100"), withholding_rate=Decimal("-0.1"))
