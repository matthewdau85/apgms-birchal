from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .base import CalculationError, TaxCalculationResult, ensure_non_negative


@dataclass(frozen=True)
class GSTCalculationData:
    """Inputs required to determine a GST liability."""

    gst_collected: Decimal
    gst_paid: Decimal
    adjustments: Decimal = Decimal("0")
    credits: Decimal = Decimal("0")

    def __post_init__(self) -> None:
        ensure_non_negative("gst_collected", self.gst_collected)
        ensure_non_negative("gst_paid", self.gst_paid)
        ensure_non_negative("adjustments", self.adjustments)
        ensure_non_negative("credits", self.credits)


class GSTCalculator:
    """GST computation rules for net tax calculation."""

    def calculate(self, data: GSTCalculationData) -> TaxCalculationResult:
        net_tax = data.gst_collected - data.gst_paid + data.adjustments - data.credits
        breakdown = {
            "gst_collected": data.gst_collected,
            "gst_paid": -data.gst_paid,
            "adjustments": data.adjustments,
            "credits": -data.credits,
        }

        return TaxCalculationResult(liability=net_tax, breakdown=breakdown).normalized()


__all__ = ["GSTCalculator", "GSTCalculationData", "CalculationError"]
