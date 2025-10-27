from decimal import Decimal, ROUND_HALF_UP

ROUNDING_QUANTUM = Decimal("0.05")


def round_currency(amount: Decimal, quantum: Decimal = ROUNDING_QUANTUM) -> Decimal:
    """Round to the nearest multiple of ``quantum`` using half-up semantics."""

    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    if not isinstance(quantum, Decimal):
        quantum = Decimal(str(quantum))
    if quantum <= 0:
        raise ValueError("quantum must be positive")

    quotient = (amount / quantum).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return (quotient * quantum).quantize(Decimal("0.01"))
