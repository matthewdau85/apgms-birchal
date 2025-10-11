from __future__ import annotations

from decimal import Decimal

from .models import CalculationInputs, CalculationResult, RuleBracket, RuleSet
from .rounding import money_round
from .rules_loader import load_rules


def _find_bracket(brackets: tuple[RuleBracket, ...], gross_income: Decimal) -> RuleBracket:
    for bracket in sorted(brackets, key=lambda item: item.lower_bound):
        upper_bound = bracket.upper_bound
        if upper_bound is None or gross_income < upper_bound:
            if gross_income >= bracket.lower_bound:
                return bracket
    raise LookupError("No tax bracket available for provided income")


def calculate_paygw_withholding(
    inputs: CalculationInputs,
    rule_pack_version: str,
    *,
    rules_loader=load_rules,
) -> CalculationResult:
    ruleset: RuleSet = rules_loader(rule_pack_version, inputs.bas_period_start)
    bracket = _find_bracket(ruleset.brackets, inputs.gross_income)
    taxable_amount = inputs.gross_income - bracket.lower_bound
    raw_withholding = bracket.base_tax + taxable_amount * bracket.marginal_rate
    rounded_withholding = money_round(raw_withholding)

    return CalculationResult(
        withheld_amount=rounded_withholding,
        rule_pack_version=rule_pack_version,
        ruleset_id=ruleset.ruleset_id,
        effective_from=ruleset.effective_from,
        effective_to=ruleset.effective_to,
        source_url=ruleset.source_url,
        source_digest=ruleset.source_digest,
    )
