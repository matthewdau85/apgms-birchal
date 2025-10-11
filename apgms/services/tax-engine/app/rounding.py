from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP, getcontext

# Ensure we have enough precision before quantisation
getcontext().prec = 28

INCREMENT = Decimal("0.05")


def money_round(value: Decimal, increment: Decimal = INCREMENT) -> Decimal:
    """Round monetary values to the nearest increment using half-up rules."""

    if increment <= 0:
        raise ValueError("Increment must be positive")

    quantised_units = (value / increment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    rounded = quantised_units * increment
    return rounded.quantize(increment, rounding=ROUND_HALF_UP)
