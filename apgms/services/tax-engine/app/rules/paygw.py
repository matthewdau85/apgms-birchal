from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, List


@dataclass(slots=True)
class PaygwBracket:
    threshold: Decimal
    rate: Decimal
    fixed: Decimal = Decimal("0")


class PaygwRuleSet:
    """Encapsulates PAYGW withholding rules for payroll events."""

    def __init__(self, brackets: Iterable[PaygwBracket] | None = None) -> None:
        self._brackets: List[PaygwBracket] = sorted(
            brackets if brackets is not None else self._default_brackets(),
            key=lambda bracket: bracket.threshold,
        )

    @staticmethod
    def _default_brackets() -> List[PaygwBracket]:
        return [
            PaygwBracket(threshold=Decimal("0"), rate=Decimal("0.1")),
            PaygwBracket(threshold=Decimal("1000"), rate=Decimal("0.2"), fixed=Decimal("100")),
            PaygwBracket(threshold=Decimal("3000"), rate=Decimal("0.3"), fixed=Decimal("500")),
        ]

    def calculate_withholding(self, gross_pay: Decimal) -> Decimal:
        if gross_pay < Decimal("0"):
            raise ValueError("Gross pay cannot be negative")
        bracket = self._brackets[0]
        for candidate in self._brackets:
            if gross_pay >= candidate.threshold:
                bracket = candidate
            else:
                break
        taxable_portion = gross_pay - bracket.threshold
        if taxable_portion < Decimal("0"):
            taxable_portion = Decimal("0")
        withholding = bracket.fixed + taxable_portion * bracket.rate
        return withholding.quantize(Decimal("0.01"))


__all__ = ["PaygwRuleSet", "PaygwBracket"]
