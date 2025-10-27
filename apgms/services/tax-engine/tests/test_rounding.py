from decimal import Decimal

from app.rounding import money_round


def test_money_round_handles_five_cent_boundaries():
    assert money_round(Decimal("0.024")) == Decimal("0.00")
    assert money_round(Decimal("0.025")) == Decimal("0.05")
    assert money_round(Decimal("0.074")) == Decimal("0.05")
    assert money_round(Decimal("0.075")) == Decimal("0.10")


def test_money_round_rejects_non_positive_increment():
    try:
        money_round(Decimal("1.00"), Decimal("0"))
    except ValueError:
        pass
    else:
        raise AssertionError("Expected ValueError for non-positive increment")
