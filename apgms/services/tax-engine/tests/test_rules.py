from decimal import Decimal

import pytest

from app.rules.gst import GSTRuleSet
from app.rules.paygw import PaygwBracket, PaygwRuleSet


def test_paygw_default_brackets_progressive() -> None:
    rules = PaygwRuleSet()
    assert rules.calculate_withholding(Decimal("500")) == Decimal("50.00")
    assert rules.calculate_withholding(Decimal("1500")) == Decimal("320.00")
    assert rules.calculate_withholding(Decimal("4000")) == Decimal("800.00")


def test_paygw_custom_brackets() -> None:
    brackets = [
        PaygwBracket(threshold=Decimal("0"), rate=Decimal("0.05")),
        PaygwBracket(threshold=Decimal("2000"), rate=Decimal("0.1"), fixed=Decimal("150")),
    ]
    rules = PaygwRuleSet(brackets)
    assert rules.calculate_withholding(Decimal("1000")) == Decimal("50.00")
    assert rules.calculate_withholding(Decimal("3000")) == Decimal("350.00")


def test_gst_standard_rate() -> None:
    rules = GSTRuleSet()
    gst_amount = rules.calculate_gst(Decimal("110.00"))
    assert gst_amount == Decimal("10.00")


def test_gst_free_sale() -> None:
    rules = GSTRuleSet()
    assert rules.calculate_gst(Decimal("100.00"), gst_free=True) == Decimal("0.00")


def test_gst_override_rate() -> None:
    rules = GSTRuleSet()
    assert rules.calculate_gst(
        Decimal("105.00"), tax_rate_override=Decimal("0.05")
    ) == Decimal("5.00")


def test_gst_negative_sale_amount_raises() -> None:
    rules = GSTRuleSet()
    with pytest.raises(ValueError):
        rules.calculate_gst(Decimal("-1"))


def test_paygw_negative_gross_pay_raises() -> None:
    rules = PaygwRuleSet()
    with pytest.raises(ValueError):
        rules.calculate_withholding(Decimal("-1"))
