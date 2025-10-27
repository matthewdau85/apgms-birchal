from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict


class CalculationError(ValueError):
    """Raised when a calculation receives invalid input."""


def _quantize(value: Decimal) -> Decimal:
    """Round currency values to two decimal places using bankers rounding."""

    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class TaxCalculationResult:
    """Represents the result of applying a tax calculation rule set."""

    liability: Decimal
    breakdown: Dict[str, Decimal]

    def normalized(self) -> "TaxCalculationResult":
        """Return a result with every value rounded to currency precision."""

        normalized_breakdown = {key: _quantize(amount) for key, amount in self.breakdown.items()}
        return TaxCalculationResult(liability=_quantize(self.liability), breakdown=normalized_breakdown)

    def to_payload(self) -> Dict[str, Decimal]:
        """Convert the result into a structure suitable for API responses."""

        normalized = self.normalized()
        return {"liability": normalized.liability, "breakdown": normalized.breakdown}


def ensure_non_negative(name: str, value: Decimal) -> Decimal:
    """Validate a decimal currency field ensuring it is non-negative."""

    if value < 0:
        raise CalculationError(f"{name} must be zero or positive. Received {value}.")
    return value


def ensure_percentage(name: str, value: Decimal) -> Decimal:
    """Validate that a decimal represents a percentage between 0 and 1."""

    if value < 0 or value > 1:
        raise CalculationError(f"{name} must be between 0 and 1 inclusive. Received {value}.")
    return value


__all__ = [
    "CalculationError",
    "TaxCalculationResult",
    "ensure_non_negative",
    "ensure_percentage",
]
