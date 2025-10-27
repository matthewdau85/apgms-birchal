from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Dict


@dataclass(slots=True)
class GstCategory:
    name: str
    rate: Decimal


class GSTRuleSet:
    """GST calculation rules for POS events."""

    def __init__(self, categories: Dict[str, GstCategory] | None = None, default_rate: Decimal | None = None) -> None:
        self._categories = categories or {
            "standard": GstCategory(name="standard", rate=Decimal("0.1")),
            "reduced": GstCategory(name="reduced", rate=Decimal("0.05")),
        }
        self._default_rate = default_rate if default_rate is not None else Decimal("0.1")

    def calculate_gst(self, sale_amount: Decimal, gst_free: bool = False, tax_rate_override: Decimal | None = None) -> Decimal:
        if sale_amount < Decimal("0"):
            raise ValueError("Sale amount cannot be negative")
        if gst_free:
            return Decimal("0.00")
        rate = self._default_rate
        if tax_rate_override is not None:
            rate = tax_rate_override
        rate = rate.quantize(Decimal("0.0001"))
        gst_amount = sale_amount * rate / (Decimal("1") + rate)
        return gst_amount.quantize(Decimal("0.01"))

    def rate_for_category(self, category: str) -> Decimal:
        if category not in self._categories:
            raise KeyError(f"Unknown GST category '{category}'")
        return self._categories[category].rate


__all__ = ["GSTRuleSet", "GstCategory"]
