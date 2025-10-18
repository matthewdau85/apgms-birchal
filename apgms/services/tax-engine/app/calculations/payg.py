from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .base import CalculationError, TaxCalculationResult, ensure_non_negative, ensure_percentage


@dataclass(frozen=True)
class PAYGCalculationData:
    """Inputs required to determine PAYG withholding obligations."""

    gross_wages: Decimal
    withholding_rate: Decimal
    instalment_credits: Decimal = Decimal("0")
    other_adjustments: Decimal = Decimal("0")

    def __post_init__(self) -> None:
        ensure_non_negative("gross_wages", self.gross_wages)
        ensure_percentage("withholding_rate", self.withholding_rate)
        ensure_non_negative("instalment_credits", self.instalment_credits)
        ensure_non_negative("other_adjustments", self.other_adjustments)


class PAYGCalculator:
    """PAYG computation rules for withholding obligations."""

    def calculate(self, data: PAYGCalculationData) -> TaxCalculationResult:
        withholding_due = data.gross_wages * data.withholding_rate
        liability = withholding_due - data.instalment_credits + data.other_adjustments
        liability = max(liability, Decimal("0"))
        breakdown = {
            "withholding_due": withholding_due,
            "instalment_credits": -data.instalment_credits,
            "other_adjustments": data.other_adjustments,
        }

        return TaxCalculationResult(liability=liability, breakdown=breakdown).normalized()


__all__ = ["PAYGCalculator", "PAYGCalculationData", "CalculationError"]
