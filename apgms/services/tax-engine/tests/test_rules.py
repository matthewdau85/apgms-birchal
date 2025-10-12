from decimal import Decimal

from hypothesis import given, strategies as st

from app.rules import calculate_threshold_adjusted_tax


@given(
    amount=st.decimals(min_value="-1000", max_value="1000", places=2),
    threshold=st.decimals(min_value="-1000", max_value="1000", places=2),
    rate=st.decimals(min_value="0", max_value="1", places=4),
)
def test_amounts_below_threshold_yield_zero(amount: Decimal, threshold: Decimal, rate: Decimal) -> None:
    assume_amount = min(amount, threshold)
    tax = calculate_threshold_adjusted_tax(amount=assume_amount, threshold=threshold, rate=rate)
    assert tax == Decimal("0.00")


@given(
    amount=st.decimals(min_value="0", max_value="100000", places=2),
    threshold=st.decimals(min_value="0", max_value="500", places=2),
    rate=st.decimals(min_value="0", max_value="1", places=4),
)
def test_tax_never_negative(amount: Decimal, threshold: Decimal, rate: Decimal) -> None:
    tax = calculate_threshold_adjusted_tax(amount=amount, threshold=threshold, rate=rate)
    assert tax >= Decimal("0.00")


@given(
    base=st.decimals(min_value="0", max_value="10000", places=2),
    threshold=st.decimals(min_value="0", max_value="500", places=2),
    rate=st.decimals(min_value="0.01", max_value="0.75", places=4),
    delta=st.decimals(min_value="0", max_value="1000", places=2),
)
def test_tax_monotonic_above_threshold(base: Decimal, threshold: Decimal, rate: Decimal, delta: Decimal) -> None:
    above = base + threshold + delta
    below = max(threshold, above - delta)

    high_tax = calculate_threshold_adjusted_tax(amount=above, threshold=threshold, rate=rate)
    low_tax = calculate_threshold_adjusted_tax(amount=below, threshold=threshold, rate=rate)

    assert high_tax >= low_tax


def test_rounding_matches_half_up() -> None:
    tax = calculate_threshold_adjusted_tax(amount="100.005", threshold="0", rate="0.10")
    assert tax == Decimal("10.01")
