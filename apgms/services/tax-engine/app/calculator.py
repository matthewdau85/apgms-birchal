from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Mapping

from .rounding import round_currency
from .rule_loader import RuleLoader, TaxRuleSet


@dataclass(frozen=True)
class CalculationResult:
    """Represents a deterministic PAYGW calculation outcome."""

    paygw_withheld: Decimal
    ruleset: TaxRuleSet


def calculate_paygw(
    *,
    inputs: Mapping[str, Decimal | int | float | str],
    rule_pack_version: str,
    bas_period_start: date,
) -> CalculationResult:
    """Deterministically calculate PAYGW withholding.

    The calculation is a pure function of the provided ``inputs`` and
    ``rule_pack_version`` when coupled with the supplied ``bas_period_start``.
    No implicit global state or "latest" ruleset lookups are performed.
    """

    loader = RuleLoader()
    ruleset = loader.load_ruleset(rule_pack_version=rule_pack_version, bas_period_start=bas_period_start)

    income = _to_decimal(inputs.get("income", 0))
    deductions = _to_decimal(inputs.get("deductions", 0))
    taxable_income = max(Decimal("0"), income - deductions)

    rate = ruleset.rate_for_income(taxable_income)
    withheld = round_currency(taxable_income * rate)
    return CalculationResult(paygw_withheld=withheld, ruleset=ruleset)


def _to_decimal(value: Decimal | int | float | str) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))
