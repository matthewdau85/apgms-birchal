"""Domain rules for GST and PAYGW calculations."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

DecimalInput = Decimal | float | int | str


def calculate_threshold_adjusted_tax(
    *, amount: DecimalInput, threshold: DecimalInput, rate: DecimalInput
) -> Decimal:
    """Return the tax payable once a threshold is exceeded.

    The function ensures deterministic rounding to two decimal places using the
    Australian Taxation Office's standard half-up strategy. Amounts below or
    equal to the threshold return zero, while negative inputs are clamped to
    zero to avoid accidental credits.
    """

    amount_dec = Decimal(str(amount))
    threshold_dec = Decimal(str(threshold))
    rate_dec = Decimal(str(rate))

    if amount_dec <= threshold_dec:
        return Decimal("0.00")

    taxable = amount_dec - threshold_dec
    if taxable <= 0:
        return Decimal("0.00")

    gross_tax = taxable * rate_dec
    rounded = gross_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return max(rounded, Decimal("0.00"))


__all__ = ["calculate_threshold_adjusted_tax"]
