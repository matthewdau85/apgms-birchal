from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, List, Sequence

from .schemas import Adjustment, AdjustmentType, TaxBreakdown, TaxEstimate, TaxInput


@dataclass(frozen=True)
class TaxRule:
    threshold: Decimal
    rate: Decimal

    def apply(self, taxable_income: Decimal, previous_threshold: Decimal) -> Decimal:
        if taxable_income <= previous_threshold:
            return Decimal("0")
        band_amount = min(taxable_income, self.threshold) - previous_threshold
        return band_amount * self.rate


class CalculationError(Exception):
    """Raised when a calculation cannot be performed."""


def compute_progressive_tax(taxable_income: Decimal, rules: Sequence[TaxRule]) -> Decimal:
    tax_total = Decimal("0")
    last_threshold = Decimal("0")

    for rule in rules:
        if taxable_income <= last_threshold:
            break
        tax_total += rule.apply(taxable_income, last_threshold)
        last_threshold = rule.threshold

    if taxable_income > last_threshold:
        # apply final bracket rate to remaining income
        tax_total += (taxable_income - last_threshold) * rules[-1].rate

    return tax_total.quantize(Decimal("0.01"))


def apply_adjustments(adjustments: Iterable[Adjustment]) -> tuple[Decimal, Decimal]:
    credits = Decimal("0")
    surcharges = Decimal("0")

    for adjustment in adjustments:
        if adjustment.type == AdjustmentType.CREDIT:
            credits += adjustment.amount
        else:
            surcharges += adjustment.amount

    return credits, surcharges


def build_tax_breakdown(
    tax_input: TaxInput, *, rules: Sequence[TaxRule]
) -> TaxBreakdown:
    taxable_income = max(
        Decimal("0"),
        tax_input.total_income - tax_input.total_deductions,
    )
    gross_tax = compute_progressive_tax(taxable_income, rules)
    credits, surcharges = apply_adjustments(tax_input.adjustments)

    net_tax = max(Decimal("0"), gross_tax - credits + surcharges - tax_input.total_withheld)
    effective_rate = (
        (net_tax / tax_input.total_income).quantize(Decimal("0.0001"))
        if tax_input.total_income > 0
        else Decimal("0")
    )

    return TaxBreakdown(
        taxable_income=taxable_income.quantize(Decimal("0.01")),
        gross_tax=gross_tax,
        credits=credits.quantize(Decimal("0.01")),
        surcharges=surcharges.quantize(Decimal("0.01")),
        net_tax=net_tax.quantize(Decimal("0.01")),
        effective_rate=effective_rate,
    )


def build_estimate(tax_input: TaxInput, *, rules: Sequence[TaxRule], warnings: List[str]) -> TaxEstimate:
    breakdown = build_tax_breakdown(tax_input, rules=rules)
    return TaxEstimate(input=tax_input, breakdown=breakdown, compliance_warnings=warnings)
